import { describe, expect, it } from 'vitest';
import { finishSet, liveSession, nextSetDraft, restLeft, startLive } from '../live';
import { exerciseHistory, personalBest, reachesBest } from '../progress';
import { exerciseSchema, sessionSchema } from '../schema';
import { logFromSummary, summarize, withLog } from '../sets';

describe('fitness single sets', () => {
  it('summarises working sets: count, heaviest weight with its reps, warm-ups left out', () => {
    expect(
      summarize([
        { reps: 10, weightKg: 40, warmup: true },
        { reps: 8, weightKg: 60 },
        { reps: 6, weightKg: 65 },
        { reps: 7, weightKg: 65 },
      ]),
    ).toEqual({ sets: 3, reps: 7, weightKg: 65 });
    expect(summarize([{ reps: 12 }, { reps: 15 }])).toEqual({ sets: 2, reps: 15 });
    expect(summarize([{ reps: 10, warmup: true }])).toEqual({});
  });

  it('keeps the summary in step and turns an empty log back into a plain row', () => {
    const e = withLog({ name: 'Rudern', sets: 9, reps: 1 }, [{ reps: 10, weightKg: 50 }]);
    expect(e).toEqual({
      name: 'Rudern',
      sets: 1,
      reps: 10,
      weightKg: 50,
      log: [{ reps: 10, weightKg: 50 }],
    });
    expect(withLog(e, [])).toEqual({ name: 'Rudern' });
    expect(exerciseSchema.safeParse(e).success).toBe(true);
  });

  it('spreads a summary into equal sets („Sätze einzeln“)', () => {
    expect(logFromSummary({ name: 'X', sets: 2, reps: 8, weightKg: 60 })).toEqual([
      { reps: 8, weightKg: 60 },
      { reps: 8, weightKg: 60 },
    ]);
    expect(logFromSummary({ name: 'X' })).toEqual([{}]);
  });

  it('measures the best per working set, never a warm-up', () => {
    const h = exerciseHistory(
      [
        {
          date: '2026-11-01',
          exercises: [
            withLog({ name: 'Bank' }, [
              { reps: 3, weightKg: 100, warmup: true },
              { reps: 8, weightKg: 70 },
              { reps: 5, weightKg: 80, note: 'schwer' },
            ]),
          ],
        },
      ],
      'Bank',
    );
    const best = personalBest(h);
    expect(best).toMatchObject({ kind: 'weight', kg: 80, reps: 5 });
    expect(reachesBest(h[0]!, best)).toBe(true);
  });

  it('accepts old sessions without a log and rejects a bad set', () => {
    expect(
      sessionSchema.safeParse({ date: '2026-11-01', exercises: [{ name: 'A', sets: 3 }] }).success,
    ).toBe(true);
    expect(exerciseSchema.safeParse({ name: 'A', log: [{ reps: 0 }] }).success).toBe(false);
  });
});

describe('fitness live session', () => {
  const at = { date: '2026-11-08', time: '18:00', now: 0 };

  it('starts from a template without old set logs', () => {
    const s = startLive(
      { title: 'Beine', exercises: [withLog({ name: 'Kniebeuge' }, [{ reps: 5, weightKg: 80 }])] },
      at,
    );
    expect(s.exercises).toEqual([{ name: 'Kniebeuge', sets: 1, reps: 5, weightKg: 80 }]);
    expect(s.sessionId).toBeUndefined();
  });

  it('logs a set and starts the rest; no rest when switched off', () => {
    let s = startLive({ exercises: [{ name: 'Kniebeuge' }] }, at);
    s = finishSet(s, { reps: 5, weightKg: 80 }, { now: 1000, restSec: 90 });
    expect(s.exercises[0]!.log).toEqual([{ reps: 5, weightKg: 80 }]);
    expect(s.index).toBe(0);
    expect(restLeft(s, 1000)).toBe(90);
    expect(restLeft(s, 92_000)).toBe(0);
    s = finishSet(s, { reps: 5, weightKg: 80 }, { now: 100_000, restSec: 0 });
    expect(s.restUntil).toBeUndefined();
    expect(s.exercises[0]).toMatchObject({ sets: 2, reps: 5, weightKg: 80 });
  });

  it('alternates a superset: no rest after the first of the pair, rest after the second', () => {
    let s = startLive(
      { exercises: [{ name: 'Bizeps', superset: true }, { name: 'Trizeps' }, { name: 'Plank' }] },
      at,
    );
    s = finishSet(s, { reps: 10 }, { now: 0, restSec: 60 });
    expect(s.index).toBe(1);
    expect(s.restUntil).toBeUndefined();
    s = finishSet(s, { reps: 12 }, { now: 0, restSec: 60 });
    expect(s.index).toBe(0);
    expect(restLeft(s, 0)).toBe(60);
  });

  it('offers the last set again, else last time’s first working set', () => {
    expect(nextSetDraft({ name: 'A', log: [{ reps: 8, weightKg: 60 }] }, undefined)).toEqual({
      reps: 8,
      weightKg: 60,
    });
    expect(
      nextSetDraft(
        { name: 'A' },
        {
          name: 'A',
          log: [
            { reps: 10, weightKg: 40, warmup: true },
            { reps: 8, weightKg: 62.5 },
          ],
        },
      ),
    ).toEqual({ reps: 8, weightKg: 62.5 });
    expect(nextSetDraft({ name: 'A' }, { name: 'A', sets: 3, reps: 5, weightKg: 80 })).toEqual({
      reps: 5,
      weightKg: 80,
    });
  });

  it('logs only the exercises with a set done, never a plan’s other rows', () => {
    let s = startLive(
      {
        title: 'Oberkörper',
        exercises: [
          { name: 'Bank', sets: 4, reps: 8, weightKg: 60 },
          { name: 'Rudern', sets: 4, reps: 10, weightKg: 50 },
          { name: 'Laufen', durationMin: 20 },
        ],
      },
      at,
    );
    s = finishSet(s, { reps: 8, weightKg: 62.5 }, { now: 0, restSec: 0 });
    expect(liveSession(s, 0).exercises).toEqual([
      { name: 'Bank', sets: 1, reps: 8, weightKg: 62.5, log: [{ reps: 8, weightKg: 62.5 }] },
    ]);
  });

  it('becomes a valid session with the minutes since the start', () => {
    let s = startLive({ exercises: [{ name: 'Kniebeuge' }, { name: ' ' }] }, at);
    s = finishSet(s, { reps: 5 }, { now: 0, restSec: 0 });
    const session = liveSession(s, 47 * 60_000);
    expect(session.durationMin).toBe(47);
    expect(session.exercises).toHaveLength(1);
    expect(liveSession(s, 10_000).durationMin).toBe(1);
    expect(sessionSchema.safeParse(session).success).toBe(true);
  });
});
