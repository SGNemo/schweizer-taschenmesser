import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { createTestDb } from '@/test-utils';
import { ensureAutoReplanOff, migratePins, resetAutoReplanCheck } from '../migrateModel';
import { assignmentRepo, itemRepo, putRow } from '../repo';
import type { AssignmentRow } from '../schema';
import { getPlannerSettings } from '../prefs';

/**
 * The one-time step into „the plan stays put“ (docs/design/planner-rethink/CONCEPT-MIGRATION.md §2): the pins of
 * before become „fest“ on the placement row. Nothing else moves; a second pass writes nothing.
 */
const TODAY = '2026-11-18'; // Wednesday
const NOW = new Date(2026, 10, 18, 8, 0).getTime();

const row = (key: string, date: string, extra: Partial<AssignmentRow> = {}) =>
  putRow(assignmentRepo, `${key}#${extra.k ?? 0}`, {
    itemKey: key,
    k: 0,
    of: 1,
    date,
    minutes: 60,
    order: 0,
    reason: 'pinned',
    ...extra,
  });
const item = (key: string, pinned?: string) =>
  putRow(itemRepo, key, {
    source: { module: 'todos', id: key.slice(6) },
    order: 0,
    ...(pinned ? { pinned } : {}),
  });
const plan = async () =>
  Object.fromEntries(
    (await assignmentRepo.active().toArray())
      .map((r) => [r.id, `${r.date}${r.locked ? ' fest' : ''}`] as const)
      .sort(),
  );

beforeEach(async () => {
  setNow(() => NOW);
  await createTestDb();
  for (const t of [
    'planner_item',
    'planner_assignment',
    '_settings',
    '_meta',
    '_secrets',
    '_outbox',
  ])
    await db.table(t).clear();
});

describe('pins become locks on the row', () => {
  it('follows the table of the concept: U1 after its repair, two passed pins, one pin three weeks ahead', async () => {
    // Laid and nailed on its day: the row is „fest“.
    await item('todos:a', '2026-11-19');
    await row('todos:a', '2026-11-19');
    // A passed pin; the old run had placed the thing anew on Friday: the row stays, not „fest“.
    await item('todos:b', '2026-11-16');
    await row('todos:b', '2026-11-20');
    // A passed pin whose row still lies on that day (no run since): „fest“, on the passed day – it is „Noch offen“.
    await item('todos:c', '2026-11-17');
    await row('todos:c', '2026-11-17');
    // A pin three weeks ahead the old engine ignored (the thing sat on Thursday): it lies there now, „fest“.
    await item('todos:d', '2026-12-09');
    await row('todos:d', '2026-11-19');
    // A pin today or later on a thing that waited: a row on that day, „fest“.
    await item('todos:e', '2026-11-21');
    // No pin: untouched.
    await item('todos:f');
    await row('todos:f', '2026-11-18', { reason: 'new' });
    // A thing in parts, the pin on the day of its second part: only that part is „fest“.
    await item('todos:g', '2026-11-20');
    await row('todos:g', '2026-11-19', { k: 0, of: 2 });
    await row('todos:g', '2026-11-20', { k: 1, of: 2 });

    expect(await migratePins(TODAY)).toBeGreaterThan(0);

    expect(await plan()).toEqual({
      'todos:a#0': '2026-11-19 fest',
      'todos:b#0': '2026-11-20',
      'todos:c#0': '2026-11-17 fest',
      'todos:d#0': '2026-12-09 fest',
      'todos:e#0': '2026-11-21 fest',
      'todos:f#0': '2026-11-18',
      'todos:g#0': '2026-11-19',
      'todos:g#1': '2026-11-20 fest',
    });
    // Every pin is gone; the item rows themselves stay.
    const items = await itemRepo.active().toArray();
    expect(items.length).toBe(7);
    expect(items.filter((i) => i.pinned)).toEqual([]);
  });

  it('writes nothing on a second pass', async () => {
    await item('todos:a', '2026-11-19');
    await row('todos:a', '2026-11-19');
    await migratePins(TODAY);
    const before = await plan();
    expect(await migratePins(TODAY)).toBe(0);
    expect(await plan()).toEqual(before);
  });

  it('takes a pin that arrives later (an old backup, a device on the old version) the same way', async () => {
    await migratePins(TODAY);
    await item('todos:late', '2026-11-20');
    await row('todos:late', '2026-11-20');
    await migratePins(TODAY);
    expect(await plan()).toEqual({ 'todos:late#0': '2026-11-20 fest' });
  });

  it('without a sync nothing is written to the settings (no other device to stop)', async () => {
    resetAutoReplanCheck();
    await ensureAutoReplanOff(await getPlannerSettings());
    expect(await db.table('_settings').count()).toBe(0);
    expect(await db.table('_outbox').count()).toBe(0);
  });

  it('with a sync set up the old automatic planning is stored as off, once', async () => {
    resetAutoReplanCheck();
    await db.table('_secrets').put({ key: 'syncConfig', value: { kind: 'server' } });
    await ensureAutoReplanOff(await getPlannerSettings());
    expect((await getPlannerSettings()).autoReplan).toBe(false);
    const writes = await db.table('_outbox').count();
    resetAutoReplanCheck();
    await ensureAutoReplanOff(await getPlannerSettings());
    expect(await db.table('_outbox').count()).toBe(writes);
  });
});
