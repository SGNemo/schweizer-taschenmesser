import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TaschenmesserDB } from '@/core/db/db';
import { createRepo, type Repo } from '@/core/db/repo';
import { syncedTableNames } from '@/core/db/schema';
import { allManifests } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { createTestDb } from '@/test-utils';
import {
  applyShare,
  createShareFile,
  newPairingCode,
  normalizeCode,
  PAIRING_WORDS,
  planShare,
  readShareFile,
  shareableModules,
  shareableTables,
} from './share';

const schema = allManifests.find((m) => m.id === 'example')!.dataSchema.collections.entry!.schema;
type Entry = { title: string; done: boolean };
const KDF = { m: 8, t: 1, p: 1 }; // tiny Argon2id parameters, only accepted in test mode
const CODE = 'apfel birne kirsche dattel feige gurke'; // invented
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

let clock = 1_800_000_000_000;
beforeEach(() => {
  clock = 1_800_000_000_000;
  setNow(() => (clock += 10));
});
afterEach(async () => {
  setNow(undefined);
  for (const db of dbs.splice(0)) {
    db.close();
    await db.delete();
  }
});

describe('what can be shared', () => {
  it('never offers the vault or the core settings', () => {
    const tables = shareableTables();
    expect(tables.some((n) => n.startsWith('accounts_') || n.startsWith('_'))).toBe(false);
    expect(shareableModules().map((m) => m.id)).not.toContain('accounts');
    expect(shareableModules().map((m) => m.id)).toContain('example');
    expect(syncedTableNames(allManifests).some((n) => n.startsWith('accounts_'))).toBe(true);
  });

  it('pairing codes have several words and are normalised before use', async () => {
    const code = await newPairingCode();
    expect(code.split(' ')).toHaveLength(PAIRING_WORDS);
    expect(normalizeCode('  Apfel   BIRNE\tkirsche ')).toBe('apfel birne kirsche');
  });
});

describe('share file', () => {
  it('carries the chosen module to the other device as a merge', async () => {
    const mine = newDb();
    const theirs = newDb();
    await entries(mine).create({ title: 'Milch', done: false });
    await entries(theirs).create({ title: 'Brot', done: false });

    const text = await createShareFile({
      modules: ['example'],
      code: CODE,
      database: mine,
      kdf: KDF,
    });
    expect(text).not.toContain('Milch'); // sealed
    const read = await readShareFile(text, ' Apfel birne KIRSCHE dattel feige gurke ');
    expect(read).toMatchObject({ ok: true, modules: ['example'] });
    if (!read.ok) return;

    const plan = await planShare(read.backup, theirs);
    expect(plan.totals).toMatchObject({ added: 1, removed: 0 });
    const { records } = await applyShare(read.backup, theirs);
    expect(records).toBe(1);
    // Merge: both entries are there, nothing was deleted.
    expect(await titles(theirs)).toEqual(['Brot', 'Milch']);
  });

  it('newer fields win and deletions travel, nothing else is removed', async () => {
    const mine = newDb();
    const theirs = newDb();
    const a = await entries(mine).create({ title: 'Alt', done: false });
    const text1 = await createShareFile({
      modules: ['example'],
      code: CODE,
      database: mine,
      kdf: KDF,
    });
    const first = await readShareFile(text1, CODE);
    if (first.ok) await applyShare(first.backup, theirs);

    await entries(mine).update(a.id, { title: 'Neu' });
    await entries(theirs).create({ title: 'Nur bei ihr', done: false });
    const text2 = await createShareFile({
      modules: ['example'],
      code: CODE,
      database: mine,
      kdf: KDF,
    });
    const second = await readShareFile(text2, CODE);
    if (second.ok) await applyShare(second.backup, theirs);
    expect(await titles(theirs)).toEqual(['Neu', 'Nur bei ihr']);

    await entries(mine).remove(a.id);
    const text3 = await createShareFile({
      modules: ['example'],
      code: CODE,
      database: mine,
      kdf: KDF,
    });
    const third = await readShareFile(text3, CODE);
    if (third.ok) await applyShare(third.backup, theirs);
    expect(await titles(theirs)).toEqual(['Nur bei ihr']);
  });

  it('ignores vault and core tables even if a hand-made file carries them', async () => {
    const theirs = newDb();
    const backup = {
      format: 'taschenmesser-backup' as const,
      version: 1,
      exportedAt: new Date().toISOString(),
      tables: {
        accounts_vault: [{ id: 'v', deletedAt: null, _f: { id: '1800000000000-0000-a' } }],
        _settings: [{ id: 's', deletedAt: null, _f: { id: '1800000000000-0000-a' } }],
      },
    };
    const plan = await planShare(backup as never, theirs);
    expect(plan.totals).toMatchObject({ added: 0, replaced: 0 });
    expect(plan.skippedTables).toBe(2);
    expect((await applyShare(backup as never, theirs)).records).toBe(0);
    expect(await theirs.table('accounts_vault').count()).toBe(0);
  });

  it('refuses a wrong code, damage, other formats and an empty choice', async () => {
    const mine = newDb();
    await entries(mine).create({ title: 'Milch', done: false });
    const text = await createShareFile({
      modules: ['example'],
      code: CODE,
      database: mine,
      kdf: KDF,
    });

    expect(await readShareFile(text, 'falsch falsch falsch')).toEqual({
      ok: false,
      reason: 'wrong-code',
    });
    const file = JSON.parse(text) as { blob: { data: string } };
    file.blob.data = 'v1.AAAA.BBBB';
    expect(await readShareFile(JSON.stringify(file), CODE)).toEqual({
      ok: false,
      reason: 'checksum-mismatch',
    });
    expect(await readShareFile('nope', CODE)).toEqual({ ok: false, reason: 'not-json' });
    expect(await readShareFile('{"format":"taschenmesser-backup"}', CODE)).toEqual({
      ok: false,
      reason: 'wrong-format',
    });
    await expect(
      createShareFile({ modules: ['accounts'], code: CODE, database: mine, kdf: KDF }),
    ).rejects.toThrow('no module chosen');
    await expect(
      createShareFile({ modules: ['example'], code: '  ', database: mine, kdf: KDF }),
    ).rejects.toThrow('empty');
  });
});
