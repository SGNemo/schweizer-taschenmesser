import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TaschenmesserDB } from '@/core/db/db';
import { createRepo, type Repo } from '@/core/db/repo';
import { allManifests } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { createTestDb } from '@/test-utils';
import { syncedTableNames } from '@/core/db/schema';
import { applyBackup } from './apply';
import {
  AUTO_DIR,
  isDue,
  listAutoBackups,
  loadAutoLast,
  runAutoBackup,
  saveAutoConfig,
  sanitizeConfig,
  type AutoBackupDeps,
} from './auto';
import { createBackup, importBackup, parseBackup, serializeBackup } from './backup';
import {
  decryptBackup,
  encryptBackup,
  parseEncryptedBackup,
  readBackupText,
  serializeEncryptedBackup,
  sha256Hex,
} from './encrypted';
import { planRestore, restoreBackup, RestoreAborted } from './restore';
import {
  AUTO_PASSPHRASE_SECRET,
  createSafetyBackup,
  namesToPrune,
  SafetyBackupError,
  type SafetyDeps,
} from './safety';
import { countByModule, verifyBackup, type VerifyDeps } from './verify';

const schema = allManifests.find((m) => m.id === 'example')!.dataSchema.collections.entry!.schema;
type Entry = { title: string; done: boolean };
const KDF = { m: 8, t: 1, p: 1 }; // tiny Argon2id parameters, only accepted in test mode
const tableNames = syncedTableNames(allManifests);

const dbs: TaschenmesserDB[] = [];
const newDb = () => {
  const db = createTestDb();
  dbs.push(db);
  return db;
};
const entries = (db: TaschenmesserDB) =>
  createRepo('example_entry', schema, db) as unknown as Repo<Entry>;
const titles = async (db: TaschenmesserDB) =>
  (await entries(db).active().toArray()).map((e) => e.title).sort();
const verifyDeps = (): VerifyDeps => ({ tableNames, createTempDb: newDb });

let clock = 1_800_000_000_000;
beforeEach(() => {
  clock = 1_800_000_000_000;
  setNow(() => (clock += 10));
});
afterEach(async () => {
  setNow();
  for (const db of dbs.splice(0)) {
    db.close();
    await db.delete();
  }
});

describe('encrypted backup', () => {
  it('round-trips and never contains the data in clear text', async () => {
    const db = newDb();
    await entries(db).create({ title: 'Geheimer Titel 🎉', done: true });
    const backup = await createBackup(db);
    const text = serializeEncryptedBackup(
      await encryptBackup(backup, 'correct horse battery', KDF),
    );

    expect(text).not.toContain('Geheimer Titel');
    expect(text).toContain('taschenmesser-backup-encrypted');
    const read = await readBackupText(text, 'correct horse battery');
    expect(read.ok && read.encrypted).toBe(true);
    if (read.ok)
      expect(read.backup.tables.example_entry![0]).toMatchObject({ title: 'Geheimer Titel 🎉' });
  });

  it('asks for a passphrase and rejects a wrong one', async () => {
    const backup = await createBackup(newDb());
    const text = serializeEncryptedBackup(await encryptBackup(backup, 'right-passphrase', KDF));
    expect(await readBackupText(text)).toEqual({ ok: false, reason: 'passphrase-required' });
    expect(await readBackupText(text, 'wrong-passphrase')).toEqual({
      ok: false,
      reason: 'wrong-passphrase',
    });
  });

  it('detects a damaged file by its checksum, before any passphrase is needed', async () => {
    const backup = await createBackup(newDb());
    const file = await encryptBackup(backup, 'right-passphrase', KDF);
    const damaged = { ...file, blob: { ...file.blob, data: file.blob.data.slice(0, -4) + 'AAAA' } };
    expect(await readBackupText(JSON.stringify(damaged))).toEqual({
      ok: false,
      reason: 'checksum-mismatch',
    });
  });

  it('detects deliberate manipulation even when the checksum was recomputed', async () => {
    const backup = await createBackup(newDb());
    const file = await encryptBackup(backup, 'right-passphrase', KDF);
    const data =
      file.blob.data.slice(0, -6) + (file.blob.data.endsWith('AAAAAA') ? 'BBBBBB' : 'AAAAAA');
    const forged = { ...file, checksum: await sha256Hex(data), blob: { ...file.blob, data } };
    const parsed = parseEncryptedBackup(JSON.stringify(forged));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const result = await decryptBackup(parsed.file, 'right-passphrase');
      expect(result.ok).toBe(false);
    }
  });

  it('refuses newer versions and other formats', () => {
    expect(parseEncryptedBackup('{"format":"x"}')).toEqual({ ok: false, reason: 'wrong-format' });
    expect(
      parseEncryptedBackup('{"format":"taschenmesser-backup-encrypted","version":99}'),
    ).toEqual({ ok: false, reason: 'newer-version' });
  });
});

describe('old backup format (fixture)', () => {
  const text = readFileSync(join(process.cwd(), 'src/core/backup/fixtures/backup-v1.json'), 'utf8');

  it('is still parsed, verified and importable', async () => {
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    const report = await verifyBackup(text, undefined, verifyDeps());
    expect(report.ok).toBe(true);
    expect(report.encrypted).toBe(false);
    expect(report.totals).toEqual({ records: 1, tombstones: 1 });

    const db = newDb();
    if (parsed.ok) await importBackup(parsed.backup, 'merge', db);
    expect(await titles(db)).toEqual(['Beispiel: Milch kaufen']);
  });

  it('is also readable through the unified reader', async () => {
    expect(await readBackupText(text)).toMatchObject({ ok: true, encrypted: false });
  });
});

describe('verify (integrity + dry-run restore)', () => {
  it('reports counts per module for a good encrypted backup and leaves live data alone', async () => {
    const db = newDb();
    const repo = entries(db);
    await repo.create({ title: 'a', done: false });
    const gone = await repo.create({ title: 'b', done: false });
    await repo.remove(gone.id);
    const text = serializeEncryptedBackup(
      await encryptBackup(await createBackup(db), 'right-passphrase', KDF),
    );

    const report = await verifyBackup(text, 'right-passphrase', verifyDeps());
    expect(report.ok).toBe(true);
    expect(report.steps.map((s) => s.status)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
    expect(report.modules.find((m) => m.module === 'example')).toEqual({
      module: 'example',
      records: 1,
      tombstones: 1,
    });
    expect(await titles(db)).toEqual(['a']);
  });

  it('fails with a precise step for wrong passphrase, damage and garbage', async () => {
    const backup = await createBackup(newDb());
    const file = await encryptBackup(backup, 'right-passphrase', KDF);
    const text = serializeEncryptedBackup(file);

    const wrong = await verifyBackup(text, 'nope-nope-nope', verifyDeps());
    expect(wrong).toMatchObject({ ok: false, failure: 'wrong-passphrase' });
    expect(wrong.steps.find((s) => s.id === 'decrypt')!.status).toBe('failed');

    const damaged = JSON.stringify({ ...file, blob: { ...file.blob, data: 'v1.AAAA.BBBB' } });
    expect(await verifyBackup(damaged, 'right-passphrase', verifyDeps())).toMatchObject({
      ok: false,
      failure: 'checksum-mismatch',
    });

    expect(await verifyBackup('not json', undefined, verifyDeps())).toMatchObject({
      ok: false,
      failure: 'not-json',
    });
  });

  it('counts tombstones and unknown tables', async () => {
    const backup = await createBackup(newDb());
    backup.tables.futuremodule_thing = [
      { id: 'x', createdAt: 1, updatedAt: 1, deviceId: 'd', deletedAt: null, _f: {} },
    ];
    expect(countByModule(backup, tableNames).some((m) => m.module === 'futuremodule')).toBe(false);
    const report = await verifyBackup(serializeBackup(backup), undefined, verifyDeps());
    expect(report).toMatchObject({ ok: true, skippedTables: 1 });
  });
});

describe('restore: preview and atomicity', () => {
  it('previews what is added, replaced and removed without writing', async () => {
    const db = newDb();
    const repo = entries(db);
    const kept = await repo.create({ title: 'bleibt', done: false });
    await repo.create({ title: 'nur im Backup', done: false });
    const backup = await createBackup(db);
    await repo.update(kept.id, { title: 'lokal geändert' });
    await repo.create({ title: 'nach dem Backup', done: false });
    const before = await titles(db);

    const plan = await planRestore(backup, 'replace', db, tableNames);
    const example = plan.modules.find((m) => m.module === 'example')!;
    expect(example).toMatchObject({ added: 0, replaced: 1, removed: 1, unchanged: 1 });
    expect(await titles(db)).toEqual(before);

    const merge = await planRestore(backup, 'merge', db, tableNames);
    expect(merge.modules.find((m) => m.module === 'example')!.removed).toBe(0);
  });

  it('a failure in the middle of a replace restores the previous state completely', async () => {
    const db = newDb();
    const repo = entries(db);
    await repo.create({ title: 'vorher', done: false });
    const backup = await createBackup(db);
    await repo.create({ title: 'danach', done: false });
    const before = await titles(db);
    const outboxBefore = await db.table('_outbox').count();

    await expect(
      applyBackup(backup, 'replace', db, tableNames, {
        afterTable: (name) => {
          if (name === 'example_entry') throw new Error('simulated crash');
        },
      }),
    ).rejects.toThrow('simulated crash');

    expect(await titles(db)).toEqual(before);
    expect(await db.table('_outbox').count()).toBe(outboxBefore);
  });

  it('a failing safety backup or an abort leaves the data untouched', async () => {
    const db = newDb();
    const repo = entries(db);
    await repo.create({ title: 'vorher', done: false });
    const backup = await createBackup(db);
    await repo.create({ title: 'danach', done: false });
    const before = await titles(db);

    await expect(
      restoreBackup(backup, 'replace', {
        database: db,
        tableNames,
        safety: () => Promise.reject(new SafetyBackupError('failed')),
      }),
    ).rejects.toBeInstanceOf(SafetyBackupError);
    expect(await titles(db)).toEqual(before);

    const controller = new AbortController();
    await expect(
      restoreBackup(backup, 'replace', {
        database: db,
        tableNames,
        safety: async () => {
          controller.abort();
          return 'x';
        },
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(RestoreAborted);
    expect(await titles(db)).toEqual(before);
  });

  it('restores after the safety copy was taken', async () => {
    const db = newDb();
    const repo = entries(db);
    await repo.create({ title: 'vorher', done: false });
    const backup = await createBackup(db);
    await repo.create({ title: 'danach', done: false });
    let safetyTitles: string[] = [];
    const result = await restoreBackup(backup, 'replace', {
      database: db,
      tableNames,
      safety: async () => {
        safetyTitles = await titles(db);
        return 'pre-restore-x.json';
      },
    });
    expect(safetyTitles).toEqual(['danach', 'vorher']);
    expect(result.summary.removed).toBe(1);
    expect(await titles(db)).toEqual(['vorher']);
  });
});

describe('safety backup', () => {
  const memoryFiles = () => {
    const store = new Map<string, string>();
    return {
      store,
      files: {
        write: async (path: string, data: string | Uint8Array) =>
          void store.set(path, String(data)),
        list: async (dir: string) =>
          [...store.keys()]
            .filter((k) => k.startsWith(`${dir}/`))
            .map((k) => k.slice(dir.length + 1)),
        remove: async (path: string) => void store.delete(path),
      },
    };
  };

  it('writes into the data folder (encrypted with the stored passphrase) and keeps only 3', async () => {
    const { store, files } = memoryFiles();
    const deps: SafetyDeps = {
      createBackup: () => createBackup(newDb()),
      files,
      isNative: true,
      saveFile: async () => 'cancelled',
      storedPassphrase: async () => 'stored-passphrase',
      kdf: KDF,
    };
    for (let i = 0; i < 5; i++) {
      clock += 5000;
      await createSafetyBackup(undefined, deps);
    }
    const names = [...store.keys()];
    expect(names).toHaveLength(3);
    expect(
      names.every((n) => n.startsWith('backups/pre-restore-') && n.endsWith('.enc.json')),
    ).toBe(true);
    expect(store.get(names[0]!)).toContain('taschenmesser-backup-encrypted');
  });

  it('in the browser a cancelled download aborts', async () => {
    const deps: SafetyDeps = {
      createBackup: () => createBackup(newDb()),
      isNative: false,
      saveFile: async () => 'cancelled',
      storedPassphrase: async () => undefined,
    };
    await expect(createSafetyBackup(undefined, deps)).rejects.toMatchObject({
      reason: 'cancelled',
    });
  });

  it('prunes by name, newest first, other files untouched', () => {
    const names = [
      'pre-restore-20260101-000000.json',
      'pre-restore-20260103-000000.json',
      'pre-restore-20260102-000000.enc.json',
      'notes.txt',
    ];
    expect(namesToPrune(names, 'pre-restore-', 2)).toEqual(['pre-restore-20260101-000000.json']);
  });
});

describe('automatic backups', () => {
  function deps(overrides: Partial<AutoBackupDeps> = {}) {
    const store = new Map<string, string>();
    const secrets = new Map<string, string>([[AUTO_PASSPHRASE_SECRET, 'auto-passphrase-1']]);
    const database = newDb();
    const d: AutoBackupDeps = {
      database,
      tableNames,
      supported: true,
      files: {
        write: async (path, data) => void store.set(path, String(data)),
        list: async (dir) =>
          [...store.keys()]
            .filter((k) => k.startsWith(`${dir}/`))
            .map((k) => k.slice(dir.length + 1)),
        remove: async (path) => void store.delete(path),
        read: async (path) => store.get(path)!,
      },
      secrets: {
        protection: 'device-key',
        get: async (n) => secrets.get(n),
        set: async (n, v) => void secrets.set(n, v),
        delete: async (n) => void secrets.delete(n),
      },
      kdf: KDF,
      ...overrides,
    };
    return { d, store, secrets };
  }
  const day = 24 * 3600_000;

  it('does nothing when disabled, unsupported or without passphrase', async () => {
    const a = deps();
    expect(await runAutoBackup({}, a.d)).toEqual({ status: 'skipped', reason: 'disabled' });
    expect(await runAutoBackup({}, deps({ supported: false }).d)).toEqual({
      status: 'skipped',
      reason: 'unsupported',
    });
    const b = deps();
    b.secrets.clear();
    await saveAutoConfig({ enabled: true, interval: 'daily', keep: 3 }, b.d.database);
    expect(await runAutoBackup({}, b.d)).toEqual({ status: 'skipped', reason: 'no-passphrase' });
  });

  it('runs on the configured rhythm and keeps only the newest N encrypted files', async () => {
    const { d, store } = deps();
    await saveAutoConfig({ enabled: true, interval: 'daily', keep: 2 }, d.database);
    await entries(d.database).create({ title: 'Wichtig', done: false });

    for (let i = 0; i < 4; i++) {
      clock += day;
      expect((await runAutoBackup({}, d)).status).toBe('created');
      expect(await runAutoBackup({}, d)).toEqual({ status: 'skipped', reason: 'not-due' });
    }
    const files = await listAutoBackups(d.files);
    expect(files).toHaveLength(2);
    expect([...store.keys()].every((k) => k.startsWith(`${AUTO_DIR}/`))).toBe(true);
    const text = store.get(`${AUTO_DIR}/${files[0]!.name}`)!;
    expect(text).not.toContain('Wichtig');
    expect(text).not.toContain('auto-passphrase-1');
    expect(await readBackupText(text, 'auto-passphrase-1')).toMatchObject({ ok: true });
    expect((await loadAutoLast(d.database))?.ok).toBe(true);
  });

  it('records a failure and keeps the older copies', async () => {
    const { d, store } = deps();
    await saveAutoConfig({ enabled: true, interval: 'daily', keep: 2 }, d.database);
    clock += day;
    await runAutoBackup({}, d);
    const good = [...store.keys()];
    d.files.write = async () => Promise.reject(new Error('disk full at /secret/path'));
    clock += day;
    expect(await runAutoBackup({}, d)).toEqual({ status: 'failed', error: 'write-failed' });
    expect([...store.keys()]).toEqual(good);
    expect(await loadAutoLast(d.database)).toMatchObject({ ok: false, error: 'write-failed' });
    expect(JSON.stringify(await loadAutoLast(d.database))).not.toContain('/secret/path');
  });

  it('sanitizes settings and computes due times', () => {
    expect(sanitizeConfig({ enabled: true, interval: 'weekly', keep: 999 })).toEqual({
      enabled: true,
      interval: 'weekly',
      keep: 30,
    });
    expect(sanitizeConfig(undefined)).toEqual({ enabled: false, interval: 'daily', keep: 7 });
    const config = sanitizeConfig({ enabled: true, interval: 'weekly' });
    expect(isDue(config, { at: 0, ok: true }, 6 * day)).toBe(false);
    expect(isDue(config, { at: 0, ok: true }, 7 * day)).toBe(true);
    expect(isDue(config, { at: 0, ok: false }, 1)).toBe(true);
  });
});

describe('no secrets in backups', () => {
  it('device-local secrets never reach a plain or encrypted backup', async () => {
    const db = newDb();
    await db.table('_secrets').put({ key: 'syncConfig', value: { token: 'invented-sync-credential' } });
    await db.table('_secrets').put({ key: 'secret:ai.claude', value: 'sk-test-fake-key' });
    await db.table('_meta').put({ key: 'backup.auto.config', value: {} });
    const backup = await createBackup(db);
    const plain = serializeBackup(backup);
    for (const needle of ['invented-sync-credential', 'sk-test-fake-key', 'syncConfig', '_secrets'])
      expect(plain).not.toContain(needle);
    expect(Object.keys(backup.tables)).not.toContain('_meta');
  });
});
