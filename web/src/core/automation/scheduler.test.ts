import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { clearAll, ctxFor, seed } from '@/core/ai/testing';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import type { EngineDeps } from './engine';
import { listLog } from './log';
import { listNotices } from './notices';
import { resetGuardCache } from './state';
import { runTick as tick, scheduleOccurrences, type Detector, type TickDeps } from './scheduler';
import type { AutomationEvent, Rule } from './types';

const { manifests, known } = ctxFor();

/** The engine reads the clock too: keep it on the tick's time. */
const runTick = (d: TickDeps, at: number) => {
  setNow(() => at);
  return tick(d, at);
};
const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m).getTime(); // 1 Nov 2026 = Sunday

let rules: Rule[] = [];
let enabled = true;
const deps = (detectors?: Detector[]) =>
  ({
    rules: async () => rules,
    settings: async () => ({ enabled, dryRun: false, globalPerHour: 0 }),
    manifests: () => manifests,
    known: () => known,
    database: db,
    ...(detectors ? { detectors: () => detectors } : {}),
  }) satisfies EngineDeps & { detectors?: () => Detector[] };

const weekly: Rule = {
  id: 'weekly',
  title: 'Weekly review',
  trigger: { kind: 'schedule', time: '18:00', weekdays: [0] },
  conditions: [],
  actions: [{ kind: 'notice', title: 'Wochenrückblick' }],
  limitPerHour: 3,
};

beforeEach(async () => {
  await clearAll();
  for (const t of ['_imports', '_meta', '_automationLog']) await db.table(t).clear();
  resetGuardCache();
  await seed();
  rules = [weekly];
  enabled = true;
});
afterAll(() => setNow());

describe('scheduleOccurrences', () => {
  it('finds Sundays 18:00 only, within (from, to]', () => {
    const t = { time: '18:00', weekdays: [0] };
    expect(scheduleOccurrences(t, at(1, 17), at(1, 18))).toEqual([at(1, 18)]);
    expect(scheduleOccurrences(t, at(1, 18), at(1, 19))).toEqual([]);
    expect(scheduleOccurrences(t, at(2, 0), at(7, 23))).toEqual([]);
    expect(scheduleOccurrences(t, at(1, 0), at(15, 23))).toEqual([
      at(1, 18),
      at(8, 18),
      at(15, 18),
    ]);
    expect(scheduleOccurrences({ time: '07:30' }, at(1, 0), at(2, 23))).toHaveLength(2);
  });
});

describe('runTick with a fake clock', () => {
  it('fires on time, once, also after a reload', async () => {
    await runTick(deps(), at(1, 17, 59));
    expect(await listNotices(db)).toHaveLength(0);
    await runTick(deps(), at(1, 18, 0));
    expect(await listNotices(db)).toHaveLength(1);
    resetGuardCache(); // reload
    await runTick(deps(), at(1, 18, 1));
    await runTick(deps(), at(1, 19, 0));
    expect(await listNotices(db)).toHaveLength(1);
    expect(await listLog(10, db)).toHaveLength(1);
  });

  it('catches up what was missed while the app was closed (at most a day)', async () => {
    await runTick(deps(), at(1, 10));
    await runTick(deps(), at(2, 9)); // opened Monday morning
    expect(await listNotices(db)).toHaveLength(1);
    await runTick(deps(), at(20, 9)); // weeks later: only the last day counts, and old hints are tidied away
    expect(await listLog(10, db)).toHaveLength(1);
    expect(await listNotices(db)).toHaveLength(0);
  });

  it('does nothing while the master switch is off, and does not replay the pause afterwards', async () => {
    enabled = false;
    await runTick(deps(), at(1, 10));
    await runTick(deps(), at(1, 19));
    expect(await listNotices(db)).toHaveLength(0);
    enabled = true;
    await runTick(deps(), at(1, 19, 1));
    expect(await listNotices(db)).toHaveLength(0);
  });

  it('runs detectors at most every ten minutes and fires on their events', async () => {
    let calls = 0;
    const detector: Detector = async ({ at: now }) => {
      calls++;
      const e: AutomationEvent = {
        type: 'pantry.belowMinimum',
        moduleId: 'pantry',
        key: 'milk',
        at: now,
        data: { name: 'Milch' },
      };
      return [e];
    };
    rules = [
      {
        id: 'stock',
        title: 'Stock',
        trigger: { kind: 'event', type: 'pantry.belowMinimum' },
        conditions: [],
        actions: [{ kind: 'notice', title: '{name} nachkaufen' }],
        limitPerHour: 3,
      },
    ];
    await runTick(deps([detector]), at(3, 10, 0));
    await runTick(deps([detector]), at(3, 10, 5));
    expect(calls).toBe(1);
    await runTick(deps([detector]), at(3, 10, 11));
    expect(calls).toBe(2);
    const notices = await listNotices(db);
    expect(notices).toHaveLength(1); // same occurrence key: once
    expect(notices[0]!.title).toBe('Milch nachkaufen');
  });

  it('a failing detector does not stop the others', async () => {
    const bad: Detector = async () => {
      throw new Error('boom');
    };
    const good: Detector = async ({ at: now }) => [{ type: 'x.y', key: 'k', at: now, data: {} }];
    rules = [{ ...weekly, id: 'x', trigger: { kind: 'event', type: 'x.y' } }];
    await runTick(deps([bad, good]), at(3, 10));
    expect(await listNotices(db)).toHaveLength(1);
  });
});
