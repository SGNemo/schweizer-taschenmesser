import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { entityRefOf } from '@/core/entitylinks/types';
import target from '../linkTarget';
import source from '../plannable';
import { subscriptionRepo } from '../repo';

/** Planner hub 2, 10a (CONCEPT §1.3): a subscription is a link target; its plan rows name it as `entityId`. */
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

describe('subscriptions as a link target', () => {
  it('alive: its name and its route, no `done` (a subscription has no „Erledigt“)', async () => {
    const s = await add();
    expect(await target.resolve(s.id)).toEqual({
      state: 'alive',
      title: 'Zeitung',
      to: `/subscriptions?open=${s.id}`,
    });
  });

  it('the plan row is an occurrence: its `entityId` is the subscription, which resolves; the row key does not', async () => {
    const s = await add();
    const [row] = await source.list({ today: '2026-11-09', until: '2026-11-22' });
    expect(row!.id).toBe(`${s.id}:2026-11-13`);
    expect(row!.entityId).toBe(s.id);
    expect(entityRefOf('subscriptions', row!)).toEqual({ module: 'subscriptions', id: s.id });
    expect(await target.resolve(row!.id)).toEqual({ state: 'gone' });
    const trial = await add({ trialEndsOn: '2026-11-15', cancelNoticeDays: undefined });
    const rows = await source.list({ today: '2026-11-09', until: '2026-11-22' });
    expect(rows.find((r) => r.id.startsWith(`${trial.id}:trial:`))!.entityId).toBe(trial.id);
  });

  it('gone: soft-deleted, never here, malformed', async () => {
    const s = await add();
    await subscriptionRepo.remove(s.id);
    expect(await target.resolve(s.id)).toEqual({ state: 'gone' });
    for (const id of ['nope', '', '1&do=cancel', '../x'])
      expect(await target.resolve(id)).toEqual({ state: 'gone' });
  });
});
