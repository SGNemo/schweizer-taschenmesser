import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { collectCalendarItems, collectNotifications } from '@/core/modules/contributions';
import { validateManifest } from '@/core/modules/registry';
import { toEpoch } from '@/core/time/dates';
import manifest from '../manifest';
import { listSubscriptionCharges, subscriptionTotals } from '../public';
import { subscriptionRepo } from '../repo';
import { subscriptionSchema } from '../schema';

const sub = (over: Record<string, unknown> = {}) =>
  subscriptionSchema.parse({
    name: 'Streaming',
    amountMinor: 1299,
    startDate: '2026-01-15',
    recurrence: { freq: 'monthly' },
    ...over,
  });

beforeEach(async () => {
  await db.table('subscriptions_subscription').clear();
  await db.table('_settings').clear();
});

describe('subscriptions module', () => {
  it('has a valid manifest', () => {
    expect(validateManifest(manifest)).toEqual([]);
  });

  it('requires a recurrence and a positive amount', () => {
    expect(
      subscriptionSchema.safeParse({ name: 'x', amountMinor: 100, startDate: '2026-01-01' })
        .success,
    ).toBe(false);
    expect(
      subscriptionSchema.safeParse({
        name: 'x',
        amountMinor: 0,
        startDate: '2026-01-01',
        recurrence: { freq: 'monthly' },
      }).success,
    ).toBe(false);
    expect(sub().active).toBe(true);
  });

  it('public API: charges in a range and totals ignore paused and deleted subscriptions', async () => {
    await subscriptionRepo.create(sub({ name: 'A', amountMinor: 1000 }));
    await subscriptionRepo.create(
      sub({
        name: 'B',
        amountMinor: 2400,
        recurrence: { freq: 'yearly' },
        startDate: '2026-10-20',
      }),
    );
    await subscriptionRepo.create(sub({ name: 'Paused', active: false }));
    const gone = await subscriptionRepo.create(sub({ name: 'Gone' }));
    await subscriptionRepo.remove(gone.id);

    const charges = await listSubscriptionCharges('2026-10-01', '2026-10-31');
    expect(charges.map((c) => [c.name, c.date, c.amountMinor])).toEqual([
      ['A', '2026-10-15', 1000],
      ['B', '2026-10-20', 2400],
    ]);
    expect(await subscriptionTotals()).toEqual({ monthly: 1000 + 200, yearly: 12000 + 2400 });
  });

  it('puts charges and cancellation deadlines on the calendar', async () => {
    await subscriptionRepo.create(sub({ cancelNoticeDays: 10 }));
    const items = await collectCalendarItems({ from: '2026-10-01', to: '2026-10-31' }, [manifest]);
    expect(items.map((i) => [i.kind, i.date])).toEqual([
      ['cancel', '2026-10-05'], // charge on 15 Oct − 10 days
      ['subscription', '2026-10-15'],
    ]);
    expect(items[0]!.title).toBe('Kündigungsfrist: Streaming');
  });

  it('notifies three days before the cancellation deadline at 09:00', async () => {
    await subscriptionRepo.create(sub({ cancelNoticeDays: 10 })); // deadline 5 Oct → reminder 2 Oct
    const at = toEpoch('2026-10-02', '09:00');
    const due = await collectNotifications({ from: at - 1000, to: at + 1000 }, [manifest]);
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({
      at,
      title: 'Kündigungsfrist endet: Streaming',
      url: '/subscriptions',
    });
    expect(await collectNotifications({ from: at + 1000, to: at + 3_600_000 }, [manifest])).toEqual(
      [],
    );
  });

  it('no notifications for subscriptions without a notice period', async () => {
    await subscriptionRepo.create(sub());
    expect(
      await collectNotifications(
        { from: toEpoch('2026-09-01', '00:00'), to: toEpoch('2026-12-31', '00:00') },
        [manifest],
      ),
    ).toEqual([]);
  });
});
