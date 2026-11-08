import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import attention from '../attention';
import { latestSession, toTemplate, weekDays, weekSummary } from '../logic';
import plannable, { DEFAULT_MINUTES } from '../plannable';
import { sessionRepo } from '../repo';

const s = (date: string, extra: object = {}) => ({ date, exercises: [], ...extra });

describe('fitness logic, package 2', () => {
  it('never counts a planned session', () => {
    const sessions = [
      s('2026-11-03', { durationMin: 50 }),
      s('2026-11-05', { durationMin: 60, planned: true }),
    ];
    expect(weekSummary(sessions, { from: '2026-11-02', to: '2026-11-08' })).toEqual({
      count: 1,
      minutes: 50,
    });
    expect(latestSession([s('2026-11-05', { planned: true }), s('2026-11-03')])?.date).toBe(
      '2026-11-03',
    );
  });

  it('sums every day of the week in plain numbers', () => {
    const days = weekDays(
      '2026-11-02',
      [s('2026-11-02', { durationMin: 40 }), s('2026-11-04', { planned: true })],
      [
        { date: '2026-11-02', kcal: 500 },
        { date: '2026-11-02', kcal: 300 },
      ],
    );
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({
      date: '2026-11-02',
      sessions: 1,
      minutes: 40,
      planned: 0,
      kcal: 800,
      meals: 2,
    });
    expect(days[2]).toMatchObject({ date: '2026-11-04', sessions: 0, planned: 1 });
    expect(days[6]!.date).toBe('2026-11-08');
  });

  it('makes a template without date, time, note or plan', () => {
    expect(
      toTemplate(
        {
          date: '2026-11-02',
          time: '18:00',
          note: 'x',
          planned: true,
          durationMin: 50,
          exercises: [{ name: 'Rudern', sets: 3 }],
        },
        'Einheit',
      ),
    ).toEqual({ title: 'Einheit', durationMin: 50, exercises: [{ name: 'Rudern', sets: 3 }] });
  });
});

describe('fitness planner source and attention', () => {
  beforeEach(async () => {
    await db.table('fitness_session').clear();
  });

  it('offers only planned sessions in the window, pinned to their day', async () => {
    await sessionRepo.create({
      date: '2026-11-09',
      title: 'Beine',
      durationMin: 50,
      exercises: [],
      planned: true,
    });
    await sessionRepo.create({ date: '2026-11-10', exercises: [], planned: true });
    await sessionRepo.create({ date: '2026-11-09', title: 'Done', exercises: [] });
    await sessionRepo.create({ date: '2026-12-30', exercises: [], planned: true });
    const items = await plannable.list({ today: '2026-11-08', until: '2026-11-15' });
    expect(items.map((i) => [i.title, i.durationMin, i.earliest, i.due])).toEqual(
      expect.arrayContaining([
        ['Training: Beine', 50, '2026-11-09', { date: '2026-11-09', hard: true }],
        ['Training: Einheit', DEFAULT_MINUTES, '2026-11-10', { date: '2026-11-10', hard: true }],
      ]),
    );
    expect(items).toHaveLength(2);
  });

  it('ticked off in the plan = logged; an edited estimate = the duration', async () => {
    const s1 = await sessionRepo.create({ date: '2026-11-09', exercises: [], planned: true });
    await plannable.onEstimate!(s1.id, 70);
    await plannable.onDone!(s1.id);
    const after = await sessionRepo.get(s1.id);
    expect(after?.planned).toBeFalsy();
    expect(after?.durationMin).toBe(70);
  });

  it('shows only a plan for today with a time the user set', async () => {
    await sessionRepo.create({
      date: '2026-11-08',
      time: '18:00',
      title: 'Beine',
      exercises: [],
      planned: true,
    });
    await sessionRepo.create({
      date: '2026-11-08',
      title: 'Ohne Zeit',
      exercises: [],
      planned: true,
    });
    await sessionRepo.create({
      date: '2026-11-08',
      time: '07:00',
      title: 'Schon gemacht',
      exercises: [],
    });
    await sessionRepo.create({ date: '2026-11-09', time: '18:00', exercises: [], planned: true });
    const items = await attention({ today: '2026-11-08' });
    expect(items.map((i) => [i.tone, i.title])).toEqual([
      ['accent', 'Heute 18:00 · Training: Beine'],
    ]);
  });
});
