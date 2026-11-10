// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
/**
 * Rows per table of the test data at `scale: 'medium'`, as `applySeed` writes them for every module
 * (desktop-only ones included). Every stimulus value and every seed guard measures this data: fewer rows mean
 * fewer buttons, frames and less height, so a removed row could hide a raised value. The numbers therefore
 * stand in `scripts/baselines/seed-rows.json`, the ratchet (scripts/ratchet.mjs) flags every lowered count,
 * and this test keeps the file equal to what the seed really writes. After adding seed rows:
 *   UPDATE_SEED_ROWS=1 npx vitest run scripts/lib/seedRows.test.ts
 */
const FILE = resolve(dirname(fileURLToPath(import.meta.url)), '../baselines/seed-rows.json');
const TODAY = '2026-09-29';

/**
 * App code is loaded by name at run time: this folder is type-checked with the Node settings
 * (tsconfig.node.json), which do not know the app's `@/` alias. Only the few members used here are typed.
 */
const load = <T>(spec: string): Promise<T> => import(/* @vite-ignore */ spec) as Promise<T>;
interface Table {
  toArray(): Promise<{ table: string }[]>;
}

async function countSeedRows(): Promise<Record<string, number>> {
  const { db } = await load<{ db: { table(name: string): Table } }>('@/core/db/db');
  const { allManifests } = await load<{ allManifests: unknown[] }>('@/core/modules/registry');
  const { applySeed } = await load<{ applySeed(opts: object): Promise<unknown> }>(
    '@/core/seed/dev',
  );
  const { SEED_TABLE } = await load<{ SEED_TABLE: string }>('@/core/seed/guard');
  const { setNow } = await load<{ setNow(fn: () => number): void }>('@/core/time/now');
  setNow(() => new Date(`${TODAY}T10:00:00`).getTime());
  await applySeed({ scale: 'medium', today: TODAY, manifests: allManifests, afterSeed: false });
  const rows: Record<string, number> = {};
  for (const r of await db.table(SEED_TABLE).toArray()) {
    // Framework tables (`_modules`, `_settings`) hold switches, not content: they follow the defaults.
    if (!r.table.startsWith('_')) rows[r.table] = (rows[r.table] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(rows).sort(([a], [b]) => a.localeCompare(b)));
}

describe('scripts/baselines/seed-rows.json', () => {
  it('holds the rows the medium seed writes, table by table', async () => {
    const rows = await countSeedRows();
    if (process.env.UPDATE_SEED_ROWS === '1')
      writeFileSync(FILE, `${JSON.stringify({ version: 1, scale: 'medium', rows }, null, 2)}\n`);
    const baseline = JSON.parse(readFileSync(FILE, 'utf8')) as {
      scale: string;
      rows: Record<string, number>;
    };
    expect(baseline.scale).toBe('medium');
    const fewer = Object.entries(baseline.rows).filter(([t, n]) => (rows[t] ?? 0) < n);
    expect(
      fewer.map(([t, n]) => `${t}: ${n} → ${rows[t] ?? 0}`),
      'seed rows were removed: the stimulus values are measured on this data. Lowering the file is a ratchet hit: name it in the PR text, the maintainer approves (docs/howto/ci.md)',
    ).toEqual([]);
    expect(
      rows,
      'seed rows were added: run UPDATE_SEED_ROWS=1 npx vitest run scripts/lib/seedRows.test.ts and commit the file',
    ).toEqual(baseline.rows);
  }, 120_000);
});
