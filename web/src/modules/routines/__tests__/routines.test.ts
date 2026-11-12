import { describe, expect, it } from 'vitest';
import { validateManifest } from '@/core/modules/registry';
import manifest from '../manifest';
import {
  donePatch,
  editPatch,
  firstDue,
  groupByRoom,
  isDue,
  newRoutine,
  nextDue,
  openEnded,
  parsePeople,
  sortRoutines,
  turnState,
  whoseTurn,
} from '../logic';
import { routineSchema, type Routine } from '../schema';

const make = (over: Partial<Routine> = {}): Routine =>
  routineSchema.parse({
    name: 'Bad putzen',
    repeat: { freq: 'weekly', interval: 1 },
    startDate: '2026-09-01', // a Tuesday
    dueDate: '2026-09-29',
    ...over,
  });

describe('routines module', () => {
  it('has a valid manifest in the household area, off by default and stable', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.area).toBe('household');
    expect(manifest.defaultEnabled).toBe(false);
    expect(manifest.maturity).toBe('stable');
  });

  it('validates routines', () => {
    expect(routineSchema.safeParse({ name: '' }).success).toBe(false);
    const r = make();
    expect(r.people).toEqual([]);
    expect(r.turn).toBe(0);
  });
});

describe('interval', () => {
  it('is due from its day on, never "late"', () => {
    const r = make({ dueDate: '2026-09-29' });
    expect(isDue(r, '2026-09-28')).toBe(false);
    expect(isDue(r, '2026-09-29')).toBe(true);
    expect(isDue(r, '2026-10-20')).toBe(true);
  });

  it("done on its day: the next turn is one interval later, on the rule's weekday", () => {
    expect(nextDue(make(), '2026-09-29')).toBe('2026-10-06');
    expect(nextDue(make({ repeat: { freq: 'weekly', interval: 2 } }), '2026-09-29')).toBe(
      '2026-10-13',
    );
  });

  it('done late: the days that passed are skipped, nothing is owed', () => {
    // Due on Tue 2026-09-29, done on Sat 2026-10-10: next is the following Tuesday, not a pile of two.
    expect(nextDue(make(), '2026-10-10')).toBe('2026-10-13');
  });

  it('done early (before its day): the routine moves a whole round on, it does not come back on the same day', () => {
    const r = make({ dueDate: '2026-09-29', people: ['Mia', 'Ben'] });
    const patch = donePatch(r, '2026-09-27');
    expect(patch).toMatchObject({ dueDate: '2026-10-06', turn: 1, lastDoneOn: '2026-09-27' });
    // A second early tick moves on again: nobody is skipped on a day that never came.
    expect(donePatch({ ...r, ...patch }, '2026-09-27')).toMatchObject({
      dueDate: '2026-10-13',
      turn: 0,
    });
  });

  it('monthly and every few days follow the core rule', () => {
    const monthly = make({ repeat: { freq: 'monthly', interval: 1 }, startDate: '2026-01-31' });
    expect(nextDue(monthly, '2026-09-29') > '2026-09-29').toBe(true);
    const daily = make({ repeat: { freq: 'daily', interval: 3 }, startDate: '2026-09-27' });
    expect(nextDue(daily, '2026-09-29')).toBe('2026-09-30');
  });

  it('a rule never ends a routine: until and count are dropped', () => {
    expect(openEnded({ freq: 'weekly', interval: 1, until: '2026-10-01', count: 3 })).toEqual({
      freq: 'weekly',
      interval: 1,
    });
    const ended = make({ repeat: { freq: 'weekly', interval: 1, until: '2026-09-30' } });
    expect(nextDue(ended, '2026-10-10')).toBe('2026-10-13');
  });

  it("first due day: the first day itself, or the rule's next day once that has passed", () => {
    const rule = { repeat: { freq: 'weekly' as const, interval: 1 }, startDate: '2026-09-29' };
    expect(firstDue(rule, '2026-09-29')).toBe('2026-09-29');
    expect(firstDue(rule, '2026-09-20')).toBe('2026-09-29');
    expect(firstDue(rule, '2026-10-01')).toBe('2026-10-06');
    expect(firstDue(rule, '2026-10-06')).toBe('2026-10-06');
  });
});

describe('rotation', () => {
  it('names take turns in order and wrap around', () => {
    let r = make({ people: ['Mia', 'Ben', 'Kim'] });
    const seen: (string | undefined)[] = [];
    for (let i = 0; i < 4; i++) {
      seen.push(whoseTurn(r));
      r = { ...r, ...donePatch(r, '2026-09-29') };
    }
    expect(seen).toEqual(['Mia', 'Ben', 'Kim', 'Mia']);
  });

  it('"Erledigt" notes who did it when, and the state before it can be put back', () => {
    const r = make({ people: ['Mia', 'Ben'], turn: 1 });
    const before = turnState(r);
    const after = { ...r, ...donePatch(r, '2026-09-29') };
    expect(after).toMatchObject({
      dueDate: '2026-10-06',
      turn: 0,
      lastDoneOn: '2026-09-29',
      lastDoneBy: 'Ben',
    });
    expect({ ...after, ...before }).toEqual(r);
  });

  it('without names nobody is named and the turn stays 0', () => {
    const r = make();
    expect(whoseTurn(r)).toBeUndefined();
    expect(donePatch(r, '2026-09-29')).toMatchObject({ turn: 0, lastDoneBy: undefined });
  });

  it('a turn beyond the list (a name was removed on another device) still names someone', () => {
    expect(whoseTurn(make({ people: ['Mia', 'Ben'], turn: 5 }))).toBe('Ben');
  });

  it('parses the names field: trimmed, no doubles, at most twelve', () => {
    expect(parsePeople(' Mia, Ben ;mia\n Kim ,, ')).toEqual(['Mia', 'Ben', 'Kim']);
    expect(parsePeople(Array.from({ length: 20 }, (_, i) => `N${i}`).join(','))).toHaveLength(12);
    expect(parsePeople('')).toEqual([]);
  });
});

describe('lists', () => {
  it('sorts due ones first, then by day and name', () => {
    const list = [
      make({ name: 'C', dueDate: '2026-10-05' }),
      make({ name: 'B', dueDate: '2026-09-29' }),
      make({ name: 'A', dueDate: '2026-10-01' }),
      make({ name: 'Z', dueDate: '2026-09-20' }),
    ];
    expect(sortRoutines(list, '2026-09-29').map((r) => r.name)).toEqual(['Z', 'B', 'A', 'C']);
  });

  it('groups by room, the ones without a room last', () => {
    const groups = groupByRoom([
      make({ name: 'x' }),
      make({ name: 'y', room: 'Küche' }),
      make({ name: 'z', room: 'Bad' }),
      make({ name: 'w', room: ' Bad ' }),
    ]);
    expect(groups.map((g) => [g.room, g.items.length])).toEqual([
      ['Bad', 2],
      ['Küche', 1],
      ['', 1],
    ]);
  });
});

describe('editor', () => {
  const formOf = (r: Routine) => ({
    name: r.name,
    room: r.room ?? '',
    repeat: r.repeat,
    people: r.people.join(', '),
    dueDate: r.dueDate,
    minutes: r.minutes,
    note: r.note ?? '',
  });

  it('a new routine is due on the day that was set, also a day in the past, and the rule counts from it', () => {
    const r = newRoutine({ ...formOf(make()), name: ' Flur wischen ', dueDate: '2026-09-20' });
    expect(routineSchema.parse(r)).toMatchObject({
      name: 'Flur wischen',
      startDate: '2026-09-20',
      dueDate: '2026-09-20',
      turn: 0,
    });
  });

  it('saving without a change writes nothing', () => {
    const r = make({ room: 'Bad', people: ['Mia', 'Ben'], turn: 1, minutes: 30, note: 'x' });
    expect(editPatch(r, formOf(r))).toEqual({});
  });

  it('a due routine stays due when only its room or note is corrected: day, anchor and turn are not written', () => {
    const r = make({ dueDate: '2026-09-26', people: ['Mia', 'Ben'], turn: 1 });
    const patch = editPatch(r, { ...formOf(r), room: 'Bad', note: 'mit Essigreiniger' });
    expect(patch).toEqual({ room: 'Bad', note: 'mit Essigreiniger' });
    expect(isDue({ ...r, ...patch }, '2026-09-29')).toBe(true);
  });

  it('a changed "Nächstes Mal" is taken as typed and becomes the rule\'s first day', () => {
    const r = make();
    expect(editPatch(r, { ...formOf(r), dueDate: '2026-10-02' })).toEqual({
      dueDate: '2026-10-02',
      startDate: '2026-10-02',
    });
  });

  it('a changed rule counts from the day the routine is due next; the day itself stays', () => {
    const r = make({ startDate: '2026-01-31', dueDate: '2026-09-30' });
    expect(editPatch(r, { ...formOf(r), repeat: { freq: 'monthly', interval: 1 } })).toEqual({
      repeat: { freq: 'monthly', interval: 1 },
      startDate: '2026-09-30',
    });
    // An end typed elsewhere is no change of the rule.
    expect(editPatch(r, { ...formOf(r), repeat: { ...r.repeat, until: '2027-01-01' } })).toEqual(
      {},
    );
  });

  it('changed names keep whoever was next while the name is still there', () => {
    const r = make({ people: ['Mia', 'Ben', 'Kim'], turn: 1 });
    expect(editPatch(r, { ...formOf(r), people: 'Kim, Ben' })).toEqual({
      people: ['Kim', 'Ben'],
      turn: 1,
    });
    expect(editPatch(r, { ...formOf(r), people: 'Mia, Kim' })).toEqual({
      people: ['Mia', 'Kim'],
      turn: 0,
    });
  });
});
