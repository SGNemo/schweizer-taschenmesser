import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TaschenmesserDB } from '@/core/db/db';
import { createRepo, type Repo } from '@/core/db/repo';
import { allManifests } from '@/core/modules/registry';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { setNow } from '@/core/time/now';
import { createTestDb } from '@/test-utils';
import { createPair, joinPair, loadPairs, pairCode, removePair, updatePair } from './pairs';
import { applyShare, createPairFile, followsReceived, peekPairId, readShareFile } from './share';

const schema = allManifests.find((m) => m.id === 'example')!.dataSchema.collections.entry!.schema;
type Entry = { title: string; done: boolean };
const KDF = { m: 8, t: 1, p: 1 };
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

const secrets = new Map<string, string>();
let clock = 1_800_000_000_000;
beforeEach(() => {
  secrets.clear();
  clock = 1_800_000_000_000;
  setNow(() => (clock += 10));
  setPlatform({
    ...createWebPlatform(),
    secrets: {
      protection: 'device-key',
      get: async (n) => secrets.get(n),
      set: async (n, v) => void secrets.set(n, v),
      delete: async (n) => void secrets.delete(n),
    },
  });
});
afterEach(async () => {
  setPlatform(undefined);
  setNow(undefined);
  for (const db of dbs.splice(0)) {
    db.close();
    await db.delete();
  }
});

describe('standing connections', () => {
  it('keep the code in the secret store, not in the data, and can be removed', async () => {
    const db = newDb();
    const { pair, code } = await createPair({ name: 'Anna', modules: ['example'] }, db);
    expect(await pairCode(pair.id)).toBe(code);
    expect(JSON.stringify(await db.table('_meta').toArray())).not.toContain(code);
    expect((await loadPairs(db)).map((p) => p.name)).toEqual(['Anna']);

    // The other side joins with the same id; joining twice does not duplicate.
    const theirs = newDb();
    await joinPair({ id: pair.id, name: 'Ben', modules: ['example'], code }, theirs);
    await joinPair({ id: pair.id, name: 'Ben', modules: ['example'], code }, theirs);
    expect(await loadPairs(theirs)).toHaveLength(1);

    await removePair(pair.id, db);
    expect(await loadPairs(db)).toEqual([]);
    expect(await pairCode(pair.id)).toBeUndefined();
  });

  it('send only what changed since the last file, and say where the next one starts', async () => {
    const mine = newDb();
    const theirs = newDb();
    const { pair, code } = await createPair({ name: 'Anna', modules: ['example'] }, mine);
    await entries(mine).create({ title: 'Milch', done: false });

    // First file: everything. Header carries the id, the payload where it ends.
    const first = await createPairFile({
      modules: ['example'],
      code,
      database: mine,
      kdf: KDF,
      pairId: pair.id,
    });
    expect(peekPairId(first.text)).toBe(pair.id);
    expect(first.rows).toBe(1);
    await updatePair(pair.id, { sentUpto: first.upto }, mine);

    const read1 = await readShareFile(first.text, code);
    expect(read1).toMatchObject({ ok: true, pairId: pair.id, range: { upto: first.upto } });
    if (!read1.ok) return;
    expect(read1.range.since).toBeUndefined();
    await applyShare(read1.backup, theirs);

    // Second file: only the new entry, starting after the first.
    await entries(mine).create({ title: 'Brot', done: false });
    const second = await createPairFile({
      modules: ['example'],
      code,
      database: mine,
      kdf: KDF,
      pairId: pair.id,
      since: first.upto,
    });
    expect(second.rows).toBe(1);
    const read2 = await readShareFile(second.text, code);
    if (!read2.ok) return;
    expect(read2.range.since).toBe(first.upto);
    expect(read2.backup.tables['example_entry']!.map((r) => r.title)).toEqual(['Brot']);
    await applyShare(read2.backup, theirs);
    expect(await titles(theirs)).toEqual(['Brot', 'Milch']);

    // Nothing new: an empty delta that still names the same end.
    const third = await createPairFile({
      modules: ['example'],
      code,
      database: mine,
      kdf: KDF,
      pairId: pair.id,
      since: second.upto,
    });
    expect(third.rows).toBe(0);
  });

  it('notice a missed file instead of silently dropping its changes', () => {
    const a = '1800000000010-0000-x';
    const b = '1800000000020-0000-x';
    expect(followsReceived({ upto: b }, undefined)).toBe(true); // a full file starts anywhere
    expect(followsReceived({ since: b, upto: b }, undefined)).toBe(false); // nothing received yet
    expect(followsReceived({ since: b }, a)).toBe(false); // an earlier file is missing
    expect(followsReceived({ since: a }, b)).toBe(true); // already past its start
    expect(followsReceived({ since: b }, b)).toBe(true);
  });
});
