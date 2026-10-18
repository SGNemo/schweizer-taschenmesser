/**
 * Sentence → preview → stored → notification, with a fixed clock (Tuesday 2026-09-29 10:00):
 * "Erinner mich um 15 Uhr an die Wäsche" must reach the in-app card and the Android schedule at 15:00,
 * and the model (if it is ever asked) sees the sentence but never an existing entry.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { collectDue } from '@/core/notifications/collect';
import { syncNativeSchedule } from '@/core/notifications/nativeSchedule';
import { checkDue, type SchedulerDeps } from '@/core/notifications/scheduler';
import { setNow } from '@/core/time/now';
import { toEpoch } from '@/core/time/dates';
import calendarManifest from '@/modules/calendar/manifest';
import { ask, type AskDeps } from '../assistant';
import type { AiProvider, CompletionRequest, CompletionResult } from '../providers/types';
import { clearAll, ctxFor, seed, TODAY, useFixedClock } from '../testing';
import { commitOps } from './commit';
import type { WriteSettings } from './stages';

beforeEach(async () => {
  useFixedClock();
  await clearAll();
  await db.table('_imports').clear();
  await db.table('_meta').clear();
  await seed();
});
afterAll(() => setNow());

const WRITE: WriteSettings = { enabled: true, modulesOff: [], cloud: true, askMissing: true };

function provider(result?: CompletionResult): AiProvider & { complete: ReturnType<typeof vi.fn> } {
  return {
    id: 'claude',
    model: 'claude-haiku-4-5',
    complete: vi.fn(async (_req: CompletionRequest) => {
      if (!result) throw new Error('the model must not be called');
      return result;
    }),
  };
}

const deps = (over: Partial<AskDeps> = {}): AskDeps => {
  const { manifests, known } = ctxFor();
  return { manifests, known, today: TODAY, database: db, write: WRITE, ...over };
};

async function propose(sentence: string, p = provider()) {
  const res = await ask(sentence, deps({ provider: p }));
  if (!res.ok || res.result.kind !== 'write') throw new Error('expected a write result');
  return { res, op: res.result.ops[0]!, p };
}

const at = (h: number, m = 0, s = 0) => new Date(2026, 8, 29, h, m, s).getTime();

describe('sentence → stored reminder → notification', () => {
  it('previews first, writes only on confirmation, then notifies at 15:00', async () => {
    const before = await db.table('calendar_event').count();
    const { res, op, p } = await propose('Erinner mich um 15 Uhr an die Wäsche');
    expect(res).toMatchObject({ tier: 'rule' });
    expect(p.complete).not.toHaveBeenCalled();
    expect(op).toMatchObject({
      ready: true,
      data: {
        title: 'Wäsche',
        kind: 'reminder',
        startDate: TODAY,
        startTime: '15:00',
        notify: { minutesBefore: 0, enabled: true },
      },
    });
    expect(op.defaulted).not.toContain('startTime');
    expect(await db.table('calendar_event').count()).toBe(before); // the preview stores nothing

    await commitOps([op], { manifests: ctxFor().known, source: 'test' });
    const stored = (await db.table('calendar_event').toArray()).find((e) => e.title === 'Wäsche');
    expect(stored).toMatchObject({ kind: 'reminder', startTime: '15:00' });

    const manifests = [calendarManifest];
    expect(
      (await collectDue({ from: at(10), to: at(14, 59) }, manifests)).map((n) => n.title),
    ).not.toContain('Wäsche');
    const due = await collectDue({ from: at(14, 59), to: at(15, 1) }, manifests);
    expect(due.filter((n) => n.title === 'Wäsche')).toEqual([
      expect.objectContaining({ at: at(15), title: 'Wäsche' }),
    ]);

    // in-app: the scheduler shows the card once when the clock passes 15:00
    const shown: string[] = [];
    let cursor: number | undefined;
    let clock = at(14, 59, 30);
    const sched: SchedulerDeps = {
      service: { permission: () => 'denied', show: vi.fn() } as never,
      loadDue: (range) => collectDue(range, manifests),
      getCursor: async () => cursor,
      setCursor: async (v) => void (cursor = v),
      now: () => clock,
      present: async (n) => (shown.push(n.title), true),
    };
    await checkDue(sched); // first run only sets the cursor
    clock = at(15, 0, 30);
    await checkDue(sched);
    await checkDue(sched);
    expect(shown.filter((t) => t === 'Wäsche')).toHaveLength(1);

    // Android: handed to the OS schedule ahead of time
    const scheduled: { title: string; at: number }[] = [];
    const n = await syncNativeSchedule({
      service: {
        permission: () => 'granted',
        scheduleUpcoming: async (items: { title: string; at: number }[]) =>
          void scheduled.push(...items),
      } as never,
      loadDue: (range) => collectDue(range, manifests),
      now: () => at(10),
    });
    expect(n).toBeGreaterThan(0);
    expect(scheduled.find((s) => s.title === 'Wäsche')?.at).toBe(at(15));
  });

  it('"in 20 Minuten Pizza rausnehmen": a reminder at 10:20, no model call', async () => {
    const { op, p } = await propose('In 20 Minuten Pizza rausnehmen');
    expect(p.complete).not.toHaveBeenCalled();
    expect(op.data).toMatchObject({
      title: 'Pizza rausnehmen',
      kind: 'reminder',
      startDate: TODAY,
      startTime: '10:20',
    });
  });

  it('without a time: 09:00 is proposed and flagged', async () => {
    const { op } = await propose('Erinnere mich übermorgen an den Geburtstag von Paula');
    expect(op).toMatchObject({
      ready: true,
      defaulted: expect.arrayContaining(['startTime']),
      data: { startDate: '2026-10-01', startTime: '09:00', notify: { enabled: true } },
    });
  });

  it('a time that is over today moves to tomorrow and says so', async () => {
    setNow(() => new Date(2026, 8, 29, 20, 0).getTime());
    const { op } = await propose('Erinner mich um 15 Uhr an die Wäsche');
    expect(op.data).toMatchObject({ startDate: '2026-09-30', startTime: '15:00' });
    expect(op.hints).toEqual(['rolled-day']);
  });

  it('a title is asked for, not guessed', async () => {
    const { op } = await propose('Erinner mich um 15 Uhr');
    expect(op).toMatchObject({ ready: false, missing: ['title'] });
  });

  it('the model path gets the same notification, and the model never sees existing entries', async () => {
    const p = provider({
      toolCalls: [
        {
          name: 'propose_actions',
          input: {
            ops: [
              {
                module: 'calendar',
                action: 'create',
                data: { title: 'Wäsche', kind: 'reminder', startDate: TODAY, startTime: '15:00' },
              },
            ],
          },
        },
      ],
      text: '',
      usage: { inputTokens: 600, outputTokens: 40 },
      model: 'claude-haiku-4-5-20251001',
    });
    const sentence = 'Gib mir gegen drei Uhr nachmittags Bescheid wegen der Wäsche';
    const { res, op } = await propose(sentence, p);
    expect(res).toMatchObject({ tier: 'model' });
    expect(op.data).toMatchObject({ notify: { minutesBefore: 0, enabled: true } });
    const sent = JSON.stringify(p.complete.mock.calls);
    expect(sent).toContain(sentence);
    for (const secret of ['Sonnenschein', 'Geheimfirma', 'Yoga', 'Miete', 'Milch kaufen', '8990'])
      expect(sent, secret).not.toContain(secret);
    expect(toEpoch(TODAY, '15:00')).toBe(at(15));
  });
});
