import { describe, expect, it } from 'vitest';
import { GROUPS, groupOf } from '../catalog';
import {
  exerciseHistory,
  exerciseOverview,
  isBestEntry,
  lastEntry,
  loadByGroup,
  personalBest,
  reachesBest,
} from '../progress';
import type { Session } from '../schema';

const s = (date: string, exercises: Session['exercises'], planned?: boolean): Session => ({
  date,
  exercises,
  ...(planned ? { planned } : {}),
});

const sessions: Session[] = [
  s('2026-11-01', [{ name: 'Kniebeuge', sets: 3, reps: 5, weightKg: 80 }]),
  s('2026-11-05', [
    { name: 'kniebeuge', sets: 3, reps: 5, weightKg: 85 },
    { name: 'Klimmzüge', sets: 3, reps: 8 },
  ]),
  s('2026-11-08', [
    { name: 'Kniebeuge', sets: 3, reps: 6, weightKg: 85 },
    { name: 'Laufen', durationMin: 30 },
  ]),
  s('2026-11-10', [{ name: 'Kniebeuge', sets: 3, reps: 5, weightKg: 90 }], true),
];

describe('fitness progress', () => {
  it('lists the history newest first, case-insensitive, never a plan', () => {
    const h = exerciseHistory(sessions, 'KNIEBEUGE');
    expect(h.map((e) => e.date)).toEqual(['2026-11-08', '2026-11-05', '2026-11-01']);
    expect(lastEntry(sessions, 'Kniebeuge')?.exercise.reps).toBe(6);
    expect(lastEntry(sessions, 'Bankdrücken')).toBeUndefined();
  });

  it('takes the heaviest weight as best, more reps at the same weight beat fewer', () => {
    const best = personalBest(exerciseHistory(sessions, 'Kniebeuge'));
    expect(best).toEqual({ kind: 'weight', kg: 85, reps: 6, date: '2026-11-08' });
  });

  it('keeps the first day a tie was reached', () => {
    const h = exerciseHistory(
      [
        s('2026-11-01', [{ name: 'Rudern', reps: 8, weightKg: 50 }]),
        s('2026-11-03', [{ name: 'Rudern', reps: 8, weightKg: 50 }]),
      ],
      'Rudern',
    );
    const best = personalBest(h);
    expect(best?.date).toBe('2026-11-01');
    // The later equal session is not the best's row, but it reaches it.
    expect(isBestEntry(h[0]!, best)).toBe(false);
    expect(reachesBest(h[0]!, best)).toBe(true);
  });

  it('counts every row of an exercise in one session (working sets, then a top set)', () => {
    const two = [
      s('2026-11-01', [
        { name: 'Kniebeuge', sets: 3, reps: 5, weightKg: 80 },
        { name: 'Kniebeuge', sets: 1, reps: 3, weightKg: 100 },
      ]),
    ];
    const h = exerciseHistory(two, 'Kniebeuge');
    expect(h).toHaveLength(2);
    expect(personalBest(h)).toMatchObject({ kg: 100, reps: 3 });
    expect(exerciseOverview(two)[0]!.times).toBe(1);
  });

  it('treats 0 kg as no weight, also for the mark', () => {
    const h = exerciseHistory([s('2026-11-01', [{ name: 'Dips', reps: 12, weightKg: 0 }])], 'Dips');
    const best = personalBest(h);
    expect(best).toMatchObject({ kind: 'reps', reps: 12 });
    expect(isBestEntry(h[0]!, best)).toBe(true);
  });

  it('falls back to reps without weight, then to the longest duration', () => {
    expect(personalBest(exerciseHistory(sessions, 'Klimmzüge'))).toEqual({
      kind: 'reps',
      reps: 8,
      date: '2026-11-05',
    });
    expect(personalBest(exerciseHistory(sessions, 'Laufen'))).toEqual({
      kind: 'minutes',
      minutes: 30,
      date: '2026-11-08',
    });
    expect(personalBest([])).toBeUndefined();
  });

  it('marks exactly the entry that set the best', () => {
    const h = exerciseHistory(sessions, 'Kniebeuge');
    const best = personalBest(h);
    expect(h.filter((e) => isBestEntry(e, best)).map((e) => e.date)).toEqual(['2026-11-08']);
  });

  it('gives an overview per exercise with group, count and last values', () => {
    const o = exerciseOverview(sessions);
    expect(o.map((x) => x.name)).toEqual(['Kniebeuge', 'Laufen', 'Klimmzüge']);
    const squat = o[0]!;
    expect(squat).toMatchObject({ group: 'legs', times: 3 });
    expect(squat.last.date).toBe('2026-11-08');
    expect(o[1]!.group).toBe('cardio');
  });

  it('guesses the group of own exercises from their words', () => {
    expect(groupOf('Kurzhantel-Rudern')).toBe('back');
    expect(groupOf('Bankdrücken')).toBe('chest');
    expect(groupOf('Tischtennis')).toBe('other');
  });

  it('sums sets per muscle group in the range, minutes for duration-only exercises', () => {
    const load = loadByGroup(sessions, { from: '2026-11-03', to: '2026-11-09' }, [
      ...GROUPS,
      'other',
    ]);
    expect(load).toEqual([
      { group: 'back', sets: 3, minutes: 0 },
      { group: 'legs', sets: 6, minutes: 0 },
      { group: 'cardio', sets: 0, minutes: 30 },
    ]);
  });
});

describe('fitness trend', () => {
  it('gives one point per day of the best’s measure, oldest first, never a zero', async () => {
    const { trendOf } = await import('../progress');
    expect(trendOf(exerciseHistory(sessions, 'Kniebeuge'))).toEqual({
      kind: 'weight',
      points: [
        { date: '2026-11-01', value: 80 },
        { date: '2026-11-05', value: 85 },
        { date: '2026-11-08', value: 85 },
      ],
    });
    expect(trendOf(exerciseHistory(sessions, 'Laufen'))?.kind).toBe('minutes');
    expect(trendOf([])).toBeUndefined();
  });
});
