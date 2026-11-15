import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { toEpoch } from '@/core/time/dates';
import { editPatch, newRoutine, reminderDays, type RoutineForm } from '../logic';
import notifications from '../notifications';
import plannable from '../plannable';
import { routineRepo } from '../repo';
import { routineSchema, type Routine } from '../schema';

const make = (over: Partial<Routine> = {}): Routine =>
  routineSchema.parse({
    name: 'Morgenroutine',
    repeat: { freq: 'daily', interval: 1 },
    startDate: '2026-09-01',
    dueDate: '2026-09-29',
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

describe('reminder days', () => {
  it('the due day and the rule’s days after it while the turn waits', () => {
    expect(reminderDays(make(), '2026-09-27', '2026-10-01')).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
    ]);
  });

  it('a weekly routine that waits is reminded on its own day only, not on the days between', () => {
    const r = make({
      repeat: { freq: 'weekly', interval: 1, byWeekday: [6] },
      startDate: '2026-09-05',
      dueDate: '2026-09-26',
    });
    expect(reminderDays(r, '2026-09-27', '2026-10-10')).toEqual(['2026-10-03', '2026-10-10']);
  });

  it('a day the user typed that is no rule day still gets its reminder', () => {
    const r = make({
      repeat: { freq: 'weekly', interval: 1, byWeekday: [6] },
      startDate: '2026-09-05',
      dueDate: '2026-09-29',
    });
    expect(reminderDays(r, '2026-09-29', '2026-10-03')).toEqual(['2026-09-29', '2026-10-03']);
  });
});

describe('reminder and planner in the form', () => {
  it('a new routine keeps the time; the planner flag is stored only when off', () => {
    expect(newRoutine(form({ remindAt: '07:30' })).remindAt).toBe('07:30');
    expect(newRoutine(form({ remindAt: '' })).remindAt).toBeUndefined();
    expect(newRoutine(form({ planner: true })).planner).toBeUndefined();
    expect(newRoutine(form({ planner: false })).planner).toBe(false);
  });

  it('an edit writes them only when changed; left out = unchanged', () => {
    const r = make({ remindAt: '07:30' });
    expect(editPatch(r, form())).toEqual({});
    expect(editPatch(r, form({ remindAt: '07:30', planner: true }))).toEqual({});
    expect(editPatch(r, form({ remindAt: '', planner: false }))).toEqual({
      remindAt: undefined,
      planner: false,
    });
    expect(editPatch(make({ planner: false }), form({ planner: true }))).toEqual({
      planner: undefined,
    });
  });
});

describe('notifications and planner source', () => {
  beforeEach(async () => {
    await db.table('routines_routine').clear();
  });

  const create = (over: Partial<Routine>) =>
    routineRepo.create({
      name: 'Abendroutine',
      repeat: { freq: 'daily', interval: 1 },
      startDate: '2026-09-29',
      dueDate: '2026-09-29',
      people: [],
      turn: 0,
      ...over,
    });

  it('only routines with a time remind; the body counts the steps, never the days', async () => {
    const r = await create({ remindAt: '20:00', steps: [{ id: 'a', text: 'Zähne putzen' }] });
    await create({ name: 'Bad putzen' });
    const out = await notifications({
      from: toEpoch('2026-09-29', '00:00'),
      to: toEpoch('2026-09-30', '23:59'),
    });
    expect(out.map((n) => n.key)).toEqual([
      `routine:${r.id}:2026-09-29T20:00`,
      `routine:${r.id}:2026-09-30T20:00`,
    ]);
    expect(out[0]).toMatchObject({ title: 'Abendroutine', body: '1 Schritt' });
    expect(out[0]!.url).toBe(`/routines?open=${r.id}`);
  });

  it('a done turn is not reminded of', async () => {
    await create({ remindAt: '20:00', dueDate: '2026-09-30' });
    const out = await notifications({
      from: toEpoch('2026-09-29', '00:00'),
      to: toEpoch('2026-09-29', '23:59'),
    });
    expect(out).toEqual([]);
  });

  it('a routine switched off for the planner is not offered to it', async () => {
    await create({ name: 'Im Plan' });
    await create({ name: 'Nicht im Plan', planner: false });
    const items = await plannable.list({ today: '2026-09-29', until: '2026-10-05' } as never);
    expect(items.map((i) => i.title)).toEqual(['Im Plan']);
  });
});
