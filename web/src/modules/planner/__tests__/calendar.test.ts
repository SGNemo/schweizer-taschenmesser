import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setSettings } from '@/core/settings/settings';
import { setNow } from '@/core/time/now';
import { buildAgenda } from '@/home/agenda';
import source, { planChips } from '../calendar';
import { assignmentRepo } from '../repo';
import { opLines } from '../say';
import { PLANNER_SCOPE } from '../settings';

const row = (date: string, itemKey: string, minutes: number) => ({ date, itemKey, minutes });

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 9, 10, 0).getTime()); // Monday 2026-11-09
  for (const t of ['planner_assignment', '_settings']) await db.table(t).clear();
});

describe('plan chips in the calendar', () => {
  it('one all-day chip per day: planned time and the number of things (sessions of one thing count once)', () => {
    const chips = planChips([
      row('2026-11-10', 'todos:a', 60),
      row('2026-11-10', 'todos:a', 25),
      row('2026-11-10', 'todos:b', 60),
      row('2026-11-09', 'todos:c', 30),
    ]);
    expect(chips.map((c) => [c.date, c.title, c.kind, c.allDay, c.to])).toEqual([
      ['2026-11-09', 'Plan · 30 Min · 1 Ding', 'plan', true, '/planner?day=2026-11-09'],
      ['2026-11-10', 'Plan · 2 h 25 · 2 Dinge', 'plan', true, '/planner?day=2026-11-10'],
    ]);
  });

  it('reads the stored sessions of the board week only (day 10 has no column to open); the switch turns the chips off', async () => {
    for (const [id, date] of [
      ['todos:a#0', '2026-11-09'],
      ['todos:b#0', '2026-11-09'],
      ['todos:c#0', '2026-11-20'],
    ] as const)
      await assignmentRepo.upsert(id, {
        itemKey: id.slice(0, -2),
        k: 0,
        of: 1,
        date,
        minutes: 30,
        order: 0,
        reason: 'new',
      });
    await assignmentRepo.remove('todos:b#0');
    const range = { from: '2026-11-09', to: '2026-11-15' };
    expect((await source(range)).map((c) => c.title)).toEqual(['Plan · 30 Min · 1 Ding']);
    // The session on the 20th is planned, but past the board's week: no chip that would open a missing column.
    expect(await source({ from: '2026-11-16', to: '2026-11-22' })).toEqual([]);
    await setSettings(PLANNER_SCOPE, { calendarChips: false });
    expect(await source(range)).toEqual([]);
  });

  it('the agenda block skips the chip (the „Heute“ card lists the ToDos already)', () => {
    const [chip] = planChips([row('2026-11-09', 'todos:a', 30)]);
    const agenda = buildAgenda([chip!], '2026-11-09');
    expect(agenda.empty).toBe(true);
  });

  it('a preview line names the date of a day beyond the board week (Thursday: „Donnerstag frei“ is next week)', () => {
    const lines = opLines(
      [{ op: 'available', date: '2026-11-12', min: 0 }],
      (k) => k,
      '2026-11-05',
    );
    expect(lines).toEqual(['Do 12.11. ist frei.']);
    expect(
      opLines([{ op: 'available', date: '2026-11-06', min: 0 }], (k) => k, '2026-11-05'),
    ).toEqual(['Fr ist frei.']);
  });
});
