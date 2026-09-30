import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { validateManifest } from '@/core/modules/registry';
import { checkId, completionRate, doneByHabit, isScheduled, recentDays, streak } from '../logic';
import manifest from '../manifest';
import { checkRepo, deleteHabit, habitRepo, setChecked } from '../repo';
import { habitSchema } from '../schema';

beforeEach(async () => {
  await db.table('habits_habit').clear();
  await db.table('habits_check').clear();
});

// 2026-09-29 is a Tuesday.
const TODAY = '2026-09-29';
const daily = { weekdays: [1, 2, 3, 4, 5, 6, 7] };
const workdays = { weekdays: [1, 2, 3, 4, 5] };

describe('habit logic', () => {
  it('knows the schedule', () => {
    expect(isScheduled(workdays, '2026-09-29')).toBe(true); // Tuesday
    expect(isScheduled(workdays, '2026-10-03')).toBe(false); // Saturday
  });

  it('counts consecutive days and does not break on an open today', () => {
    const done = new Set(['2026-09-28', '2026-09-27', '2026-09-26']);
    expect(streak(daily, done, TODAY)).toBe(3); // today still open
    expect(streak(daily, new Set([...done, TODAY]), TODAY)).toBe(4);
    expect(streak(daily, new Set(['2026-09-27']), TODAY)).toBe(0); // yesterday missed
    expect(streak(daily, new Set(), TODAY)).toBe(0);
  });

  it('skips days the habit is not scheduled on', () => {
    // Mon 28, Fri 25 done; the weekend in between does not break it.
    expect(streak(workdays, new Set(['2026-09-28', '2026-09-25']), TODAY)).toBe(2);
    expect(streak(workdays, new Set(['2026-09-28', '2026-09-24']), TODAY)).toBe(1); // Fri 25 missed
  });

  it('builds the last days and the completion rate', () => {
    const done = new Set(['2026-09-29', '2026-09-28']);
    const cells = recentDays(workdays, done, TODAY, 7);
    expect(cells).toHaveLength(7);
    expect(cells[0]).toMatchObject({ date: '2026-09-23', scheduled: true, done: false });
    expect(cells.at(-1)).toMatchObject({ date: TODAY, done: true });
    expect(cells.filter((c) => !c.scheduled).map((c) => c.date)).toEqual([
      '2026-09-26',
      '2026-09-27',
    ]);
    expect(completionRate(daily, done, TODAY, 4)).toBe(50);
    expect(completionRate({ weekdays: [] }, done, TODAY)).toBeUndefined();
  });

  it('groups ticks per habit', () => {
    const map = doneByHabit([
      { habitId: 'a', date: '2026-09-01' },
      { habitId: 'a', date: '2026-09-02' },
      { habitId: 'b', date: '2026-09-01' },
    ]);
    expect([...map.get('a')!]).toEqual(['2026-09-01', '2026-09-02']);
    expect(map.get('b')!.size).toBe(1);
  });
});

describe('habits module', () => {
  it('has a valid manifest and is off by default', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.defaultEnabled).toBe(false);
  });

  it('defaults to every day and needs at least one weekday', () => {
    expect(habitSchema.parse({ name: 'Lesen' }).weekdays).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(habitSchema.safeParse({ name: 'x', weekdays: [] }).success).toBe(false);
    expect(habitSchema.safeParse({ name: 'x', weekdays: [8] }).success).toBe(false);
  });

  it('ticks idempotently with a deterministic id and revives removed ticks', async () => {
    const h = await habitRepo.create(habitSchema.parse({ name: 'Lesen' }));
    await setChecked(h.id, TODAY, true);
    await setChecked(h.id, TODAY, true);
    expect(await checkRepo.active().count()).toBe(1);
    expect((await checkRepo.get(checkId(h.id, TODAY)))?.date).toBe(TODAY);

    await setChecked(h.id, TODAY, false);
    expect(await checkRepo.active().count()).toBe(0);
    await setChecked(h.id, TODAY, false); // no-op
    await setChecked(h.id, TODAY, true);
    expect(await checkRepo.active().count()).toBe(1);
  });

  it('deleting a habit removes its ticks', async () => {
    const h = await habitRepo.create(habitSchema.parse({ name: 'Lesen' }));
    await setChecked(h.id, TODAY, true);
    await setChecked(h.id, '2026-09-28', true);
    await deleteHabit(h.id);
    expect(await habitRepo.active().count()).toBe(0);
    expect(await checkRepo.active().count()).toBe(0);
  });
});
