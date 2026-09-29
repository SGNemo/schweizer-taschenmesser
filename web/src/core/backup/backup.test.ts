import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRepo, type Repo } from '@/core/db/repo';
import { allManifests } from '@/core/modules/registry';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import { runSync } from '@/core/sync/engine';
import { MemoryServer } from '@/core/sync/testing';
import { setNow } from '@/core/time/now';
import { createTestDb } from '@/test-utils';
import type { TaschenmesserDB } from '@/core/db/db';
import {
  BACKUP_VERSION,
  backupFileName,
  createBackup,
  importBackup,
  parseBackup,
  serializeBackup,
} from './backup';

const schema = allManifests.find((m) => m.id === 'example')!.dataSchema.collections.entry!.schema;
type Entry = { title: string; done: boolean; note?: string };

interface Dev {
  db: TaschenmesserDB;
  repo: Repo<Entry>;
  storage: DexieStorageAdapter;
}
const devs: Dev[] = [];
let clock = 1_800_000_000_000;

function dev(): Dev {
  const db = createTestDb();
  const d = {
    db,
    repo: createRepo('example_entry', schema, db) as unknown as Repo<Entry>,
    storage: new DexieStorageAdapter(db),
  };
  devs.push(d);
  return d;
}
const titles = async (d: Dev) => (await d.repo.active().toArray()).map((e) => e.title).sort();

beforeEach(() => {
  clock = 1_800_000_000_000;
  setNow(() => (clock += 10));
});
afterEach(async () => {
  setNow();
  for (const d of devs.splice(0)) {
    d.db.close();
    await d.db.delete();
  }
});

describe('createBackup / parseBackup', () => {
  it('contains synced tables incl. tombstones, and never device-local data', async () => {
    const a = dev();
    const keep = await a.repo.create({ title: 'bleibt', done: false });
    const gone = await a.repo.create({ title: 'weg', done: false });
    await a.repo.remove(gone.id);
    await a.db.table('_secrets').put({ key: 'syncConfig', value: { token: 'geheim' } });

    const backup = await createBackup(a.db, undefined, new Date('2026-09-29T10:00:00Z'));
    expect(backup).toMatchObject({
      format: 'taschenmesser-backup',
      version: BACKUP_VERSION,
      exportedAt: '2026-09-29T10:00:00.000Z',
    });
    expect(Object.keys(backup.tables)).toEqual(
      expect.arrayContaining(['example_entry', '_settings', '_modules', 'todos_task']),
    );
    for (const local of ['_secrets', '_meta', '_outbox'])
      expect(backup.tables).not.toHaveProperty(local);
    expect(backup.tables.example_entry!.map((r) => r.id).sort()).toEqual([keep.id, gone.id].sort());
    expect(serializeBackup(backup)).not.toContain('geheim');
    expect(backupFileName(new Date('2026-09-29T10:00:00Z'))).toBe(
      'taschenmesser-backup-2026-09-29.json',
    );
  });

  it('round-trips through JSON text', async () => {
    const a = dev();
    await a.repo.create({ title: 'Übung 🎉', done: true, note: 'n' });
    const text = serializeBackup(await createBackup(a.db));
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok)
      expect(parsed.backup.tables.example_entry![0]).toMatchObject({
        title: 'Übung 🎉',
        done: true,
        note: 'n',
      });
  });

  it('rejects files that are not (valid, current) backups', () => {
    expect(parseBackup('nope')).toEqual({ ok: false, reason: 'not-json' });
    expect(parseBackup('[]')).toEqual({ ok: false, reason: 'wrong-format' });
    expect(parseBackup('{"format":"other"}')).toEqual({ ok: false, reason: 'wrong-format' });
    const base = { format: 'taschenmesser-backup', version: 1, exportedAt: 'x' };
    expect(parseBackup(JSON.stringify({ ...base, version: 99, tables: {} }))).toEqual({
      ok: false,
      reason: 'newer-version',
    });
    expect(parseBackup(JSON.stringify({ ...base, tables: 'x' }))).toEqual({
      ok: false,
      reason: 'invalid',
    });
    const row = { id: 'a', deletedAt: null, _f: { title: 'bad-hlc' } };
    expect(parseBackup(JSON.stringify({ ...base, tables: { t: [row] } }))).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(parseBackup(JSON.stringify({ ...base, tables: { t: [{ ...row, _f: {} }] } })).ok).toBe(
      true,
    );
  });
});

describe('import: merge', () => {
  it('restores into an empty database, keeps the stamps and queues everything for sync', async () => {
    const a = dev();
    const b = dev();
    const r = await a.repo.create({ title: 'Milch', done: false });
    await a.repo.update(r.id, { done: true });
    const backup = await createBackup(a.db);

    const summary = await importBackup(backup, 'merge', b.db);
    expect(summary.skippedTables).toBe(0);
    const restored = await b.repo.table.get(r.id);
    const original = await a.repo.table.get(r.id);
    expect(restored).toMatchObject({ title: 'Milch', done: true });
    expect(restored!._f).toEqual(original!._f);
    expect(await b.storage.pendingCount()).toBeGreaterThan(0);
  });

  it('keeps newer local edits and adds missing records (last write wins per field)', async () => {
    const a = dev();
    const r = await a.repo.create({ title: 'alt', done: false });
    const backup = await createBackup(a.db);
    await a.repo.update(r.id, { title: 'neuer lokal' });
    const other = await a.repo.create({ title: 'nach dem Backup', done: false });

    await importBackup(backup, 'merge', a.db);
    expect((await a.repo.get(r.id))?.title).toBe('neuer lokal');
    expect((await a.repo.get(other.id))?.title).toBe('nach dem Backup'); // nothing is deleted
  });

  it('skips tables this version does not know', async () => {
    const a = dev();
    const backup = await createBackup(a.db);
    backup.tables.futuremodule_thing = [
      {
        id: 'x',
        createdAt: 1,
        updatedAt: 1,
        deviceId: 'd',
        deletedAt: null,
        _f: { name: '1900000000000-0000-aaaa0001' },
        name: 'n',
      },
    ];
    expect((await importBackup(backup, 'merge', a.db)).skippedTables).toBe(1);
  });
});

describe('import: replace', () => {
  it('makes the backup the truth: extra records deleted, changed ones reverted, removed fields removed', async () => {
    const a = dev();
    const r = await a.repo.create({ title: 'Original', done: false });
    const deleted = await a.repo.create({ title: 'war schon gelöscht', done: false });
    await a.repo.remove(deleted.id);
    const backup = await createBackup(a.db);

    await a.repo.update(r.id, { title: 'danach geändert', note: 'kam später dazu', done: true });
    const extra = await a.repo.create({ title: 'nach dem Backup', done: false });
    await a.repo.restore(deleted.id);

    const summary = await importBackup(backup, 'replace', a.db);
    expect(summary.removed).toBe(1);
    expect(await a.repo.get(r.id)).toMatchObject({ title: 'Original', done: false });
    expect('note' in ((await a.repo.get(r.id)) as object)).toBe(false);
    expect(await a.repo.get(extra.id)).toBeUndefined();
    expect(await a.repo.get(deleted.id)).toBeUndefined(); // tombstone from the backup is restored
    expect(await titles(a)).toEqual(['Original']);
  });

  it('leaves tables alone that are not part of the file', async () => {
    const a = dev();
    await a.repo.create({ title: 'bleibt', done: false });
    const backup = await createBackup(a.db);
    delete backup.tables.example_entry;
    await importBackup(backup, 'replace', a.db);
    expect(await titles(a)).toEqual(['bleibt']);
  });

  it('wins against stamps from the future that this session has not seen', async () => {
    const a = dev();
    const r = await a.repo.create({ title: 'Original', done: false });
    const backup = await createBackup(a.db);
    // A field edited by a device whose clock is far ahead (e.g. loaded before a reload).
    await a.db.table('example_entry').update(r.id, {
      title: 'from the future',
      '_f.title': '1999999999999-0000-zzzz0001',
    });
    await importBackup(backup, 'replace', a.db);
    expect((await a.repo.get(r.id))?.title).toBe('Original');
  });

  it('propagates through sync: another device ends up with the restored state', async () => {
    const server = new MemoryServer();
    const sync = (d: Dev) => runSync({ storage: d.storage, adapter: server.adapter() });
    const a = dev();
    const b = dev();
    const r = await a.repo.create({ title: 'Original', done: false });
    await sync(a);
    await sync(b);
    const backup = await createBackup(a.db);

    // Both devices keep working after the backup was taken.
    await a.repo.update(r.id, { title: 'A danach' });
    const bOnly = await b.repo.create({ title: 'nur auf B', done: false });
    await sync(a);
    await sync(b);
    await sync(a);
    expect(await titles(b)).toEqual(['A danach', 'nur auf B']);

    await importBackup(backup, 'replace', a.db);
    await sync(a);
    await sync(b);
    expect(await titles(a)).toEqual(['Original']);
    expect(await titles(b)).toEqual(['Original']);
    expect(await b.repo.get(bOnly.id)).toBeUndefined();
  });
});
