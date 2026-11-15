import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { runMigrations } from '@/core/modules/migrate';
import type { Recurrence } from '@/core/recurrence/types';
import manifest from '../manifest';
import {
  allStepsDone,
  doneSteps,
  donePatch,
  editPatch,
  newRoutine,
  parseSteps,
  RHYTHMS,
  rhythmOf,
  ruleOf,
  sortRoutines,
  stepsOf,
  stepsText,
  toggleStepPatch,
  type RoutineForm,
} from '../logic';
import { routineRepo } from '../repo';
import { routineSchema, type Routine } from '../schema';
import { ROUTINE_START_IDS, ROUTINE_STARTS } from '../starts';

const make = (over: Partial<Routine> = {}): Routine =>
  routineSchema.parse({
    name: 'Morgenroutine',
    repeat: { freq: 'daily', interval: 1 },
    startDate: '2026-09-01',
    dueDate: '2026-09-29',
    steps: [
      { id: 'a', text: 'Wasser trinken' },
      { id: 'b', text: 'Zähne putzen' },
      { id: 'c', text: 'Anziehen' },
    ],
    ...over,
  });

const form = (over: Partial<RoutineForm> = {}): RoutineForm => ({
  name: 'Morgenroutine',
  room: '',
  repeat: { freq: 'daily', interval: 1 },
  people: '',
  dueDate: '2026-09-29',
  note: '',
  ...over,
});

let n = 0;
const ids = () => `n${++n}`;

describe('steps', () => {
  beforeEach(() => {
    n = 0;
  });

  it('one per line; empty lines and list marks are dropped', () => {
    expect(parseSteps('- Wasser\n\n  • Zähne putzen \n* Anziehen', [], ids)).toEqual([
      { id: 'n1', text: 'Wasser' },
      { id: 'n2', text: 'Zähne putzen' },
      { id: 'n3', text: 'Anziehen' },
    ]);
  });

  it('a line that stays keeps its id (also with other capitals), a new one gets a new id', () => {
    const before = [
      { id: 'a', text: 'Wasser trinken' },
      { id: 'b', text: 'Zähne putzen' },
    ];
    expect(parseSteps('zähne putzen\nDuschen\nWasser trinken', before, ids)).toEqual([
      { id: 'b', text: 'zähne putzen' },
      { id: 'n1', text: 'Duschen' },
      { id: 'a', text: 'Wasser trinken' },
    ]);
    expect(stepsText(before)).toBe('Wasser trinken\nZähne putzen');
  });

  it('with the same number of lines, a corrected line keeps the id of the step at its place', () => {
    const before = [
      { id: 'a', text: 'Wasser trinken' },
      { id: 'b', text: 'Zähne putzn' },
    ];
    expect(parseSteps('Wasser trinken\nZähne putzen', before, ids)).toEqual([
      { id: 'a', text: 'Wasser trinken' },
      { id: 'b', text: 'Zähne putzen' },
    ]);
    // A line more: the changed text is a new step.
    expect(
      parseSteps('Wasser trinken\nZähne putzen\nAnziehen', before, ids).map((s) => s.id),
    ).toEqual(['a', 'n1', 'n2']);
  });

  it('at most 40 steps', () => {
    const text = Array.from({ length: 50 }, (_, i) => `Schritt ${i}`).join('\n');
    expect(parseSteps(text, [], ids)).toHaveLength(40);
  });

  it('a row without the field (an older device) has no steps', () => {
    expect(stepsOf(make({ steps: undefined }))).toEqual([]);
  });
});

describe('ticking steps', () => {
  it('ticks count only for the turn that is due now', () => {
    const r = make();
    const one = { ...r, ...toggleStepPatch(r, 'b', true) };
    expect(one.progress).toEqual({ day: '2026-09-29', done: ['b'] });
    expect([...doneSteps(one)]).toEqual(['b']);
    // The next turn starts with nothing ticked, without a write.
    const next = { ...one, ...donePatch(one, '2026-09-29') };
    expect(doneSteps(next).size).toBe(0);
  });

  it('keeps the order of the steps and forgets steps that were removed', () => {
    let r = make();
    r = { ...r, ...toggleStepPatch(r, 'c', true) };
    r = { ...r, ...toggleStepPatch(r, 'a', true) };
    expect(r.progress?.done).toEqual(['a', 'c']);
    r = { ...r, ...toggleStepPatch(r, 'c', false) };
    expect(r.progress?.done).toEqual(['a']);
    const shorter = { ...r, steps: [{ id: 'b', text: 'Zähne putzen' }] };
    expect(doneSteps(shorter).size).toBe(0);
  });

  it('all done only when every step is ticked; a routine without steps never is', () => {
    let r = make();
    for (const id of ['a', 'b']) r = { ...r, ...toggleStepPatch(r, id, true) };
    expect(allStepsDone(r)).toBe(false);
    r = { ...r, ...toggleStepPatch(r, 'c', true) };
    expect(allStepsDone(r)).toBe(true);
    expect(allStepsDone(make({ steps: [] }))).toBe(false);
  });
});

describe('„Wie oft“ in plain words', () => {
  it('every plain choice gives a rule that reads back as the same choice', () => {
    for (const r of RHYTHMS) {
      if (r === 'custom') continue;
      expect(rhythmOf(ruleOf(r, [6]))).toBe(r);
    }
  });

  it('„An bestimmten Tagen“ starts with Monday to Friday and keeps chosen days', () => {
    expect(ruleOf('weekdays').byWeekday).toEqual([1, 2, 3, 4, 5]);
    expect(ruleOf('weekdays', [2, 4]).byWeekday).toEqual([2, 4]);
  });

  it('any other rule is „Anders“', () => {
    const others: Recurrence[] = [
      { freq: 'daily', interval: 3 },
      { freq: 'weekly', interval: 3 },
      { freq: 'weekly', interval: 2, byWeekday: [1] },
      { freq: 'monthly', interval: 1, byMonthDay: 15 },
      { freq: 'monthly', interval: 3 },
      { freq: 'yearly', interval: 1 },
    ];
    for (const rule of others) expect(rhythmOf(rule)).toBe('custom');
  });
});

describe('new and edited routines', () => {
  it('a new routine with weekdays starts on the first of them (Saturday after a Tuesday)', () => {
    const r = newRoutine(
      form({ repeat: { freq: 'weekly', interval: 1, byWeekday: [6] }, dueDate: '2026-09-29' }),
    );
    expect(r.dueDate).toBe('2026-10-03');
    expect(r.startDate).toBe('2026-10-03');
    // Without weekdays it is due on the day set, as before.
    expect(newRoutine(form()).dueDate).toBe('2026-09-29');
  });

  it('keeps steps and time of day', () => {
    const steps = [{ id: 'x', text: 'Zähne putzen' }];
    const r = newRoutine(form({ steps, daypart: 'evening' }));
    expect(r.steps).toEqual(steps);
    expect(r.daypart).toBe('evening');
    expect(newRoutine(form()).steps).toEqual([]);
  });

  it('an edit writes the steps and the time of day only when they changed', () => {
    const r = make({ daypart: 'morning' });
    expect(editPatch(r, form({ steps: r.steps, daypart: 'morning' }))).toEqual({});
    expect(editPatch(r, form())).toEqual({});
    const fewer = r.steps!.slice(0, 2);
    expect(editPatch(r, form({ steps: fewer, daypart: undefined }))).toEqual({
      steps: fewer,
      daypart: undefined,
    });
  });

  it('a rule changed to weekdays moves the next day to the first of them', () => {
    // Due Tuesday 2026-09-29, now only on Saturdays.
    const r = make({ repeat: { freq: 'weekly', interval: 1 } });
    const patch = editPatch(r, form({ repeat: { freq: 'weekly', interval: 1, byWeekday: [6] } }));
    expect(patch).toMatchObject({ dueDate: '2026-10-03', startDate: '2026-10-03' });
    // Still on one of the days: it stays due.
    const tue = editPatch(r, form({ repeat: { freq: 'weekly', interval: 1, byWeekday: [2, 6] } }));
    expect(tue.dueDate).toBeUndefined();
    expect(tue.startDate).toBe('2026-09-29');
  });

  it('due ones sort morning before evening before any time', () => {
    const list = [
      make({ name: 'C', daypart: undefined }),
      make({ name: 'A', daypart: 'evening' }),
      make({ name: 'B', daypart: 'morning' }),
    ];
    expect(sortRoutines(list, '2026-09-29').map((r) => r.name)).toEqual(['B', 'A', 'C']);
  });
});

describe('starts', () => {
  it('every start has a name, steps and a rule that is a plain choice', async () => {
    const { t } = await import('@/strings');
    for (const id of ROUTINE_START_IDS) {
      expect(t.routines.starts[id].name).not.toBe('');
      expect(t.routines.starts[id].steps.length).toBeGreaterThan(2);
      expect(rhythmOf(ROUTINE_STARTS[id].repeat)).not.toBe('custom');
    }
  });
});

describe('migration 2: steps', () => {
  beforeEach(async () => {
    await db.table('routines_routine').clear();
  });

  it('rewrites nothing (a write could win over steps another device added); the row reads as no steps', async () => {
    const old = await routineRepo.create({
      name: 'Bad putzen',
      room: 'Bad',
      repeat: { freq: 'weekly', interval: 1 },
      startDate: '2026-09-01',
      dueDate: '2026-09-29',
      people: ['Mia', 'Ben'],
      turn: 1,
    });
    await db.table('_meta').put({ key: 'moduleVersion.routines', value: 1 });
    await runMigrations(manifest);
    const after = await routineRepo.get(old.id);
    expect(after?.updatedAt).toBe(old.updatedAt);
    expect(stepsOf(after!)).toEqual([]);
    expect(after).toMatchObject({
      name: 'Bad putzen',
      room: 'Bad',
      people: ['Mia', 'Ben'],
      turn: 1,
    });
  });
});
