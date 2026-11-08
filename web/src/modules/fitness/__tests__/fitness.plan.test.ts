import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import aiDefaults from '../aiDefaults';
import attention from '../attention';
import { lastOf, latestSession, toTemplate, weekDays, weekSummary } from '../logic';
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
      '2026-11-02',
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

  it('fills „last time“ only from what was done, and shows plans only from today on', () => {
    const sessions = [
      s('2026-11-03', { exercises: [{ name: 'Rudern', weightKg: 40 }] }),
      s('2026-11-09', { planned: true, exercises: [{ name: 'Rudern', weightKg: 60 }] }),
    ];
    expect(lastOf(sessions, 'Rudern')?.weightKg).toBe(40);
    const days = weekDays(
      '2026-11-02',
      [s('2026-11-03', { planned: true }), s('2026-11-06', { planned: true })],
      [],
      '2026-11-05',
    );
    expect(days[1]!.planned).toBe(0);
    expect(days[4]!.planned).toBe(1);
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
    setNow(() => new Date(2026, 10, 8, 12, 0).getTime());
    await db.table('fitness_session').clear();
  });
  afterEach(() => setNow());

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
    // Planned for tomorrow, ticked off today: it counts today (same as „Erledigt“ on the page).
    expect(after?.date).toBe('2026-11-08');
  });

  it('makes a session for a later day from the assistant a plan', async () => {
    expect(await aiDefaults('session', { date: '2026-11-12' })).toEqual({ planned: true });
    expect(await aiDefaults('session', { date: '2026-11-08' })).toEqual({});
    expect(await aiDefaults('session', {})).toEqual({ date: '2026-11-08' });
    expect(await aiDefaults('meal', { date: '2026-11-12' })).toEqual({});
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
