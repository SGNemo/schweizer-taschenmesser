// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { applySeed, removeSeed } from '@/core/seed/dev';
import { setNow } from '@/core/time/now';
import { assignmentRepo } from '../repo';
import { ASSIGNMENT_REASONS } from '../schema';

const REASON = ASSIGNMENT_REASONS[0];

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

  it('a row the service planned too early and the seed run took away again is test data too', async () => {
    // What a slow device does: the planner's own run fires between the todos rows and the planner's rows, so the
    // task that is meant to stay out ("excluded") gets a row; the seed's run then deletes it. The tombstone must
    // not stay in the sync outbox (develop was red this way under load, e2e/seed/seed.spec.ts).
    const stray = 'todos:seed-todos-task-2';
    await assignmentRepo.upsert(`${stray}#0`, {
      itemKey: stray,
      k: 0,
      of: 1,
      date: TODAY,
      minutes: 30,
      order: 0,
      reason: REASON,
    });
    expect(await db.table('_outbox').count()).toBe(1);
    await applySeed({ scale: 'small', today: TODAY, afterSeed: true });
    const row = await db.table('planner_assignment').get(`${stray}#0`);
    expect(row?.deletedAt, 'the seed run took the row away').not.toBeNull();
    expect(await db.table('_outbox').count()).toBe(0);
    await removeSeed();
    expect(await db.table('planner_assignment').get(`${stray}#0`)).toBeUndefined();
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
