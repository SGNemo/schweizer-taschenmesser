import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import history from './schema-history.json';
import snapshot from './schema.snapshot.json';
import { TaschenmesserDB } from './db';

/**
 * Users update the app with data on the device: every released database version must open with the
 * current schema, keep all rows and lose no table. Fixtures come from the git history
 * (`schema-history.json`); when the schema is bumped, add the previous version there.
 */

type Stores = Record<string, string>;
const versions = Object.entries(history.versions as Record<string, Stores>).map(
  ([v, stores]) => [Number(v), stores] as const,
);

/** Builds a row that satisfies the primary key of a Dexie store definition. */
function sampleRow(definition: string, n: number): Record<string, unknown> {
  const primary = definition.split(',')[0]!.trim();
  const base = { updatedAt: 1000 + n, createdAt: 1000, deletedAt: null, _f: {}, value: `row-${n}` };
  if (primary.startsWith('++')) return { ...base };
  if (primary.startsWith('[')) {
    const parts = primary.slice(1, -1).split('+');
    return { ...base, ...Object.fromEntries(parts.map((p) => [p, `${p}-${n}`])) };
  }
  return { ...base, [primary]: `${primary}-${n}` };
}

describe('database upgrades', () => {
  it('has fixtures for the versions that were released', () => {
    expect(versions.map(([v]) => v)).toEqual([1, 2, 3, 4, 5, 7, 8, 12, 13, 14, 16]);
    expect(snapshot.version).toBeGreaterThan(Math.max(...versions.map(([v]) => v)));
  });

  it.each(versions)(
    'opens a version %i database with the current schema and keeps its data',
    async (version, stores) => {
      const name = `upgrade-v${version}-${Math.random().toString(36).slice(2)}`;
      const old = new Dexie(name);
      old.version(version).stores(stores);
      const seeded: Record<string, number> = {};
      for (const [table, definition] of Object.entries(stores)) {
        const rows = [sampleRow(definition, 1), sampleRow(definition, 2)];
        await old.table(table).bulkAdd(rows);
        seeded[table] = rows.length;
      }
      old.close();

      const current = new TaschenmesserDB(name);
      await current.open();
      try {
        expect(current.verno).toBe(snapshot.version);
        const tables = current.tables.map((t) => t.name);
        for (const [table, count] of Object.entries(seeded)) {
          expect(tables, `table ${table} must survive`).toContain(table);
          expect(await current.table(table).count(), table).toBe(count);
        }
        // Everything the current schema knows exists, so features can be used right after the update.
        for (const table of Object.keys(snapshot.stores)) expect(tables).toContain(table);
      } finally {
        current.close();
        await Dexie.delete(name);
      }
    },
  );

  it('can be written to after an upgrade (new tables and indexes work)', async () => {
    const [version, stores] = versions.at(-1)!;
    const name = `upgrade-write-${Math.random().toString(36).slice(2)}`;
    const old = new Dexie(name);
    old.version(version).stores(stores);
    await old.table('_meta').put({ key: 'deviceId', value: 'abc' });
    old.close();

    const current = new TaschenmesserDB(name);
    try {
      await current.table('_aiCache').put({ key: 'k', intent: {}, createdAt: 1 });
      await current.table('_blobs').put({ key: 'b', type: 'text/plain', data: new ArrayBuffer(1) });
      expect(await current.table('_aiCache').where('createdAt').below(2).count()).toBe(1);
      expect((await current.table('_meta').get('deviceId'))?.value).toBe('abc');
    } finally {
      current.close();
      await Dexie.delete(name);
    }
  });
});
