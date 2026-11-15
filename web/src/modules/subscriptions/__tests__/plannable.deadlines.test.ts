import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setSettings } from '@/core/settings/settings';
import source from '../plannable';
import { subscriptionRepo } from '../repo';

/**
 * Planner hub S2 (CONCEPT-SOURCES §3.2 row 4, CONCEPT-LINKS L7, P86): the trial end is a deadline, a passed
 * deadline is still handed over, only the next one per subscription, and every row carries „Kündigen …“.
 */
const ctx = { today: '2026-11-09', until: '2026-11-22' };
const add = (over: Record<string, unknown> = {}) =>
  subscriptionRepo.create({
    name: 'Zeitung',
    amountMinor: 9900,
    startDate: '2025-11-20',
    recurrence: { freq: 'yearly' },
    cancelNoticeDays: 7,
    active: true,
    ...over,
  } as never);

beforeEach(async () => {
  await db.table('subscriptions_subscription').clear();
  await db.table('_settings').clear();
});

describe('subscription deadlines in the plan (S2)', () => {
  it('every row has „Kündigen …“ → the subscription with `do=cancel`, never a tick', async () => {
    const s = await add();
    const [item] = await source.list(ctx);
    expect(item).toMatchObject({
      kind: 'cancel',
      action: { label: 'Kündigen …', to: `/subscriptions?open=${s.id}&do=cancel` },
    });
    expect(source.onDone).toBeUndefined();
  });

  it('the trial end is a deadline of its own: „<Abo>: Probezeit endet“, hard on its last day', async () => {
    const s = await add({ cancelNoticeDays: undefined, trialEndsOn: '2026-11-18' });
    expect(await source.list(ctx)).toEqual([
      expect.objectContaining({
        id: `${s.id}:trial:2026-11-18`,
        kind: 'cancel',
        title: 'Zeitung: Probezeit endet',
        durationMin: 15,
        priority: 3,
        due: { date: '2026-11-18', hard: true },
        to: `/subscriptions?open=${s.id}`,
        action: { label: 'Kündigen …', to: `/subscriptions?open=${s.id}&do=cancel` },
      }),
    ]);
  });

  it('only the NEXT deadline per subscription: the trial end or the notice deadline, whichever comes first', async () => {
    // Notice deadline 13 Nov, trial end 18 Nov → the notice deadline.
    const a = await add({ trialEndsOn: '2026-11-18' });
    // Trial end 11 Nov, notice deadline 13 Nov → the trial end.
    const b = await add({ name: 'Kino', trialEndsOn: '2026-11-11' });
    const items = await source.list(ctx);
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.id.startsWith(a.id))).toMatchObject({
      title: 'Zeitung kündigen',
      due: { date: '2026-11-13', hard: true },
    });
    expect(items.find((i) => i.id.startsWith(b.id))).toMatchObject({
      title: 'Kino: Probezeit endet',
      due: { date: '2026-11-11', hard: true },
    });
  });

  it('a trial end beyond the plan, or one that passed more than a week ago, is no row', async () => {
    await add({ cancelNoticeDays: undefined, trialEndsOn: '2026-12-01' });
    await add({ cancelNoticeDays: undefined, trialEndsOn: '2026-10-30' });
    expect(await source.list(ctx)).toEqual([]);
  });

  it('P86: a passed deadline is still handed over with its date in the past („Frist vorbei“), kind `cancel`', async () => {
    // Yearly charge on 12 Nov with 7 days' notice: the deadline was 5 Nov.
    const s = await add({ startDate: '2025-11-12' });
    expect(await source.list(ctx)).toEqual([
      expect.objectContaining({
        id: `${s.id}:2026-11-05`,
        kind: 'cancel',
        due: { date: '2026-11-05', hard: true },
      }),
    ]);
    // A trial that ended three days ago, too.
    await db.table('subscriptions_subscription').clear();
    const trial = await add({ cancelNoticeDays: undefined, trialEndsOn: '2026-11-06' });
    expect(await source.list(ctx)).toEqual([
      expect.objectContaining({
        id: `${trial.id}:trial:2026-11-06`,
        due: { date: '2026-11-06', hard: true },
      }),
    ]);
  });

  it('a deadline missed more than a week ago is no row and never hides an upcoming trial end', async () => {
    // Yearly charge on 20 Dec, 90 days' notice: the deadline was 21 Sep (49 days ago); trial ends 15 Nov.
    const s = await add({
      startDate: '2025-12-20',
      cancelNoticeDays: 90,
      trialEndsOn: '2026-11-15',
    });
    expect(await source.list(ctx)).toEqual([
      expect.objectContaining({
        id: `${s.id}:trial:2026-11-15`,
        title: 'Zeitung: Probezeit endet',
        due: { date: '2026-11-15', hard: true },
      }),
    ]);
    // Without a trial: no stale „kündigen“ row either.
    await db.table('subscriptions_subscription').clear();
    await add({ startDate: '2025-12-20', cancelNoticeDays: 90 });
    expect(await source.list(ctx)).toEqual([]);
  });

  it('a paused or cancelled subscription has no trial row; „Im Plan zeigen“ off → nothing', async () => {
    await add({ active: false, trialEndsOn: '2026-11-12' });
    await add({ recurrence: { freq: 'yearly', until: '2026-11-20' }, trialEndsOn: '2026-11-12' });
    expect(await source.list(ctx)).toEqual([]);
    await add({ trialEndsOn: '2026-11-12' });
    expect(await source.list(ctx)).toHaveLength(1);
    await setSettings('module.subscriptions', { showInPlan: false });
    expect(await source.list(ctx)).toEqual([]);
  });
});
