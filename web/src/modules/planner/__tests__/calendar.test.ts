import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setSettings } from '@/core/settings/settings';
import { buildAgenda } from '@/home/agenda';
import source, { planChips } from '../calendar';
import { assignmentRepo } from '../repo';
import { PLANNER_SCOPE } from '../settings';

const row = (date: string, itemKey: string, minutes: number) => ({ date, itemKey, minutes });

beforeEach(async () => {
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

  it('reads the stored sessions of the range; the switch turns the chips off', async () => {
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
    await setSettings(PLANNER_SCOPE, { calendarChips: false });
    expect(await source(range)).toEqual([]);
  });

  it('the agenda block skips the chip (the „Heute“ card lists the ToDos already)', () => {
    const [chip] = planChips([row('2026-11-09', 'todos:a', 30)]);
    const agenda = buildAgenda([chip!], '2026-11-09');
    expect(agenda.empty).toBe(true);
  });
});
