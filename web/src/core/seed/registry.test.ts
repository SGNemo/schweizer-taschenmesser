import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { TaschenmesserDB } from '@/core/db/db';
import { tableName } from '@/core/db/schema';
import { allManifests } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { createSeedContext } from './context';
import { applySeed, orderBySeedDeps, planRows, removeSeed } from './dev';
import { SEED_FILES, loadSeedModule } from './modules';
import { SEED_SCALES } from './types';

/**
 * The seed contract for EVERY module: new modules fail here until they ship `seed.ts` and the
 * `seed` field in the manifest (recipe: docs/HOW-TO.md "Seed bauen").
 */
const TODAY = '2026-09-29';
const withData = allManifests.filter((m) => !m.seed.none);
let counter = 0;
const databases: TaschenmesserDB[] = [];
const freshDb = () => {
  const database = new TaschenmesserDB(`seed-test-${counter++}`);
  databases.push(database);
  return database;
};

beforeEach(() => setNow(() => new Date(`${TODAY}T10:00:00`).getTime()));
afterAll(async () => {
  setNow();
  for (const d of databases) {
    d.close();
    await d.delete();
  }
});

describe('seed contract', () => {
  it('every manifest declares a seed with a version and known dependencies', () => {
    const ids = new Set(allManifests.map((m) => m.id));
    for (const m of allManifests) {
      expect(Number.isInteger(m.seed.version) && m.seed.version >= 1, `${m.id}: seed.version`).toBe(
        true,
      );
      for (const dep of m.seed.dependsOn)
        expect(ids.has(dep), `${m.id} depends on ${dep}`).toBe(true);
    }
  });

  it('modules without seed data are exactly the live-data ones, all others ship seed.ts', () => {
    for (const m of allManifests) {
      if (m.seed.none) expect(SEED_FILES, `${m.id} must not ship seed.ts`).not.toContain(m.id);
      else expect(SEED_FILES, `${m.id}: src/modules/${m.id}/seed.ts missing`).toContain(m.id);
    }
  });

  it('dependencies are seeded first and there are no cycles', () => {
    const order = orderBySeedDeps(allManifests).map((m) => m.id);
    for (const m of allManifests)
      for (const dep of m.seed.dependsOn)
        expect(order.indexOf(dep)).toBeLessThan(order.indexOf(m.id));
  });

  describe.each(withData.map((m) => [m.id, m] as const))('%s', (_id, manifest) => {
    it.each(SEED_SCALES)('is deterministic and valid (%s)', async (scale) => {
      const mod = (await loadSeedModule(manifest.id))!;
      const make = () =>
        mod.seed(createSeedContext({ moduleId: manifest.id, today: TODAY, scale }));
      const first = make();
      expect(JSON.stringify(first)).toBe(JSON.stringify(make()));
      const plan = planRows(manifest, first, allManifests);
      let total = 0;
      for (const write of plan) {
        const ids = new Set<string>();
        for (const item of write.items) {
          expect(ids.has(item.id), `${manifest.id}: duplicate id ${item.id}`).toBe(false);
          ids.add(item.id);
          const parsed = write.manifest.dataSchema.collections[write.collection]!.schema.safeParse(
            item.data,
          );
          expect(
            parsed.success,
            `${manifest.id}.${write.collection} ${item.id}: ${JSON.stringify(parsed.error?.issues)}`,
          ).toBe(true);
        }
        total += write.items.length;
      }
      // Modules that build their data in `afterSeed` (the vault demo) may return no plain rows.
      if (!mod.afterSeed) expect(total, `${manifest.id} seeds nothing`).toBeGreaterThan(0);
    });

    it('scales up: small ≤ medium ≤ large', async () => {
      const mod = (await loadSeedModule(manifest.id))!;
      const count = (scale: 'small' | 'medium' | 'large') =>
        Object.values(
          mod.seed(createSeedContext({ moduleId: manifest.id, today: TODAY, scale })),
        ).reduce((n, r) => n + r.length, 0);
      expect(count('small')).toBeLessThanOrEqual(count('medium'));
      expect(count('medium')).toBeLessThanOrEqual(count('large'));
    });
  });
});

describe('seed runner', () => {
  it('writes through the repos without queueing sync, then removes everything again', async () => {
    const database = freshDb();
    const state = await applySeed({
      scale: 'small',
      today: TODAY,
      database,
      manifests: allManifests,
      afterSeed: false,
    });
    expect(state.scale).toBe('small');
    expect(await database.table('_outbox').count()).toBe(0);
    const registered = await database.table('_seeds').count();
    expect(registered).toBeGreaterThan(withData.length);
    // Every row has a valid envelope (the repo wrote it).
    const sample = await database.table(tableName('todos', 'task')).toCollection().first();
    expect(sample).toMatchObject({ deletedAt: null });
    expect(sample._f).toBeTruthy();

    await removeSeed(database, allManifests);
    for (const m of allManifests)
      for (const c of Object.keys(m.dataSchema.collections))
        expect(await database.table(tableName(m.id, c)).count(), `${m.id}_${c}`).toBe(0);
    expect(await database.table('_seeds').count()).toBe(0);
    expect(await database.table('_outbox').count()).toBe(0);
  });

  it('is repeatable with identical output (same ids, same data)', async () => {
    const a = freshDb();
    const b = freshDb();
    await applySeed({
      scale: 'small',
      today: TODAY,
      database: a,
      manifests: allManifests,
      afterSeed: false,
    });
    await applySeed({
      scale: 'small',
      today: TODAY,
      database: b,
      manifests: allManifests,
      afterSeed: false,
    });
    for (const m of withData)
      for (const c of Object.keys(m.dataSchema.collections)) {
        const strip = (rows: Record<string, unknown>[]) =>
          rows
            .map(
              ({ createdAt, updatedAt, deviceId, _f, ...rest }) => (
                void [createdAt, updatedAt, deviceId, _f],
                rest
              ),
            )
            .sort((x, y) => String(x.id).localeCompare(String(y.id)));
        const t = tableName(m.id, c);
        expect(strip(await a.table(t).toArray())).toEqual(strip(await b.table(t).toArray()));
      }
  });
});
