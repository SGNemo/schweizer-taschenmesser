// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { applySeed, removeSeed } from '@/core/seed/dev';
import { setNow } from '@/core/time/now';

/**
 * The planner's first run over the test data (`afterSeed`) writes `planner_item` / `planner_assignment` rows
 * for every planner source. Each of them must be registered as seed data: otherwise it enters the sync outbox
 * and survives "remove test data" (develop went red this way when invoices and subscriptions became sources
 * and only todos were registered). Behaviour-based on purpose: a new source with seed rows fails here
 * without anyone having to remember a list.
 */
const TODAY = '2026-09-29';

beforeEach(async () => {
  setNow(() => new Date(`${TODAY}T10:00:00`).getTime());
  localStorage.clear();
  await Promise.all(db.tables.map((t) => t.clear()));
});

const sourceOf = (key: string) => key.split(':')[0];

describe('planner rows made by the seed run', () => {
  it('cover every planner source with seed rows and are all seed data', async () => {
    await applySeed({ scale: 'small', today: TODAY, afterSeed: true });
    const rows = [
      ...(await db.table('planner_item').toArray()).map((r) => String(r.id)),
      ...(await db.table('planner_assignment').toArray()).map((r) => String(r.itemKey)),
    ];
    const sources = new Set(rows.map(sourceOf));
    // todos, invoices and subscriptions all contribute seed rows to the planner
    for (const s of ['todos', 'invoices', 'subscriptions']) expect(sources, s).toContain(s);
    // none of them reached the sync outbox
    expect(await db.table('_outbox').count()).toBe(0);
  });

  it('are gone after "remove test data"', async () => {
    await applySeed({ scale: 'small', today: TODAY, afterSeed: true });
    expect(await db.table('planner_assignment').count()).toBeGreaterThan(0);
    await removeSeed();
    for (const t of ['planner_item', 'planner_assignment'])
      expect(
        await db
          .table(t)
          .filter((r) => r.deletedAt == null)
          .count(),
        t,
      ).toBe(0);
    expect(await db.table('_outbox').count()).toBe(0);
  });
});
