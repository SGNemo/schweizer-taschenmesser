import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setSettings } from '@/core/settings/settings';
import attention, { PRICE_HINTS_KEY } from '../attention';
import manifest from '../manifest';
import { subscriptionRepo } from '../repo';

const rise = (date: string, fromMinor = 1299, toMinor = 1499) => ({ date, fromMinor, toMinor });

async function add(history = [rise('2026-10-01')]) {
  return subscriptionRepo.create({
    name: 'Netflix',
    amountMinor: 1499,
    startDate: '2026-01-15',
    recurrence: { freq: 'monthly', interval: 1 },
    active: true,
    priceHistory: history,
  });
}

beforeEach(async () => {
  await db.table('subscriptions_subscription').clear();
  await db.table('_settings').clear();
  await db.table('_meta').delete(PRICE_HINTS_KEY);
});

describe('"Preis erhöht" under Jetzt wichtig', () => {
  it('is contributed by the module', () => {
    expect(manifest.contributions?.attention).toBeTypeOf('function');
  });

  it('announces a fresh rise calmly (not red) with old and new price', async () => {
    await add();
    const [item, ...rest] = await attention({ today: '2026-10-02' });
    expect(rest).toEqual([]);
    expect(item).toMatchObject({ tone: 'accent', to: '/subscriptions' });
    expect(item!.title).toContain('Netflix');
    expect(item!.title).toContain('14,99');
    expect(item!.title).toContain('12,99');
  });

  it('shows it for a few days from the first sight and then never again', async () => {
    await add();
    expect(await attention({ today: '2026-10-02' })).toHaveLength(1);
    expect(await attention({ today: '2026-10-03' })).toHaveLength(1);
    expect(await attention({ today: '2026-10-05' })).toHaveLength(0);
    // Later days never bring it back: the first sight is remembered on this device.
    expect(await attention({ today: '2026-10-20' })).toHaveLength(0);
  });

  it('does not announce an old rise when the app sees it for the first time', async () => {
    await add([rise('2026-05-01')]);
    expect(await attention({ today: '2026-10-02' })).toEqual([]);
  });

  it('ignores price cuts and subscriptions that are paused', async () => {
    await add([rise('2026-10-01', 1499, 1299)]);
    expect(await attention({ today: '2026-10-02' })).toEqual([]);
    await db.table('subscriptions_subscription').clear();
    const paused = await add();
    await subscriptionRepo.update(paused.id, { active: false });
    expect(await attention({ today: '2026-10-02' })).toEqual([]);
  });

  it('is off when the user switched it off', async () => {
    await add();
    await setSettings('module.subscriptions', { priceHint: false });
    expect(await attention({ today: '2026-10-02' })).toEqual([]);
  });

  it('announces only the newest rise', async () => {
    await add([rise('2026-09-20', 999, 1299), rise('2026-10-01')]);
    // Only the newest rise counts: one notice, not a flood.
    expect(await attention({ today: '2026-10-02' })).toHaveLength(1);
  });
});
