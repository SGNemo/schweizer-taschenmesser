import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setSettings } from '@/core/settings/settings';
import manifest from '../manifest';
import source from '../plannable';
import { subscriptionRepo } from '../repo';

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

describe('cancellation deadlines as a planner source', () => {
  it('lists the next deadline within the plan as „<Abo> kündigen“, 15 Min, prio 3, hard', async () => {
    const s = await add();
    const items = await source.list(ctx);
    expect(items).toEqual([
      expect.objectContaining({
        id: `${s.id}:2026-11-13`,
        kind: 'cancel',
        title: 'Zeitung kündigen',
        to: `/subscriptions?open=${s.id}`,
        durationMin: 15,
        priority: 3,
        due: { date: '2026-11-13', hard: true },
      }),
    ]);
  });

  it('months as notice move by calendar months (core/deadline/notice)', async () => {
    await add({ startDate: '2026-02-15', cancelNoticeDays: 90, cancelNoticeMonths: 3 });
    expect((await source.list(ctx))[0]?.due).toEqual({ date: '2026-11-15', hard: true });
  });

  it('no item without a notice period, for a paused or an already cancelled one, or outside the plan', async () => {
    await add({ cancelNoticeDays: undefined });
    await add({ active: false });
    await add({ recurrence: { freq: 'yearly', until: '2026-11-20' } });
    await add({ startDate: '2026-03-01' });
    expect(await source.list(ctx)).toEqual([]);
  });

  it('„Im Plan zeigen“ off → no items; nothing is written back', async () => {
    await add();
    await setSettings('module.subscriptions', { showInPlan: false });
    expect(await source.list(ctx)).toEqual([]);
    expect(source.onDone).toBeUndefined();
    expect(source.onAssign).toBeUndefined();
    expect(manifest.contributions?.plannable).toBeDefined();
  });
});
