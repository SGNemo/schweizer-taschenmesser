import { describe, expect, it } from 'vitest';
import {
  byDay,
  costShares,
  isSortKey,
  mainCurrency,
  NO_CATEGORY,
  otherCurrencyCount,
  sortList,
  sumByCurrency,
  upcomingCharges,
  yearlyRanking,
} from '../overview';
import { subscriptionSchema } from '../schema';

const TODAY = '2026-11-15';
let n = 0;
const sub = (over: Record<string, unknown> = {}) => ({
  id: `s${++n}`,
  ...subscriptionSchema.parse({
    name: 'Streaming',
    amountMinor: 1200,
    startDate: '2026-01-20',
    recurrence: { freq: 'monthly' },
    ...over,
  }),
});

describe('cost shares (donut)', () => {
  const a = sub({ name: 'Video', category: 'streaming', amountMinor: 1200 });
  const b = sub({ name: 'Film', category: 'streaming', amountMinor: 600 });
  const c = sub({ name: 'Musik', category: 'music', amountMinor: 1000 });
  const d = sub({ name: 'Domain', amountMinor: 3600, recurrence: { freq: 'yearly' } });
  const paused = sub({ name: 'Pause', category: 'music', amountMinor: 9999, active: false });
  const ended = sub({
    name: 'Alt',
    category: 'music',
    amountMinor: 9999,
    recurrence: { freq: 'monthly', until: '2026-10-01' },
  });
  const usd = sub({ name: 'US', category: 'software', amountMinor: 500, currency: 'USD' });
  const all = [a, b, c, d, paused, ended, usd];

  it('groups by category per month, largest first; none is its own group', () => {
    expect(costShares(all, TODAY, 'category', 'EUR')).toEqual([
      { id: 'streaming', label: 'streaming', value: 1800 },
      { id: 'music', label: 'music', value: 1000 },
      { id: NO_CATEGORY, label: NO_CATEGORY, value: 300 },
    ]);
  });

  it('gives one slice per subscription by provider', () => {
    expect(costShares(all, TODAY, 'provider', 'EUR').map((s) => [s.label, s.value])).toEqual([
      ['Video', 1200],
      ['Musik', 1000],
      ['Film', 600],
      ['Domain', 300],
    ]);
  });

  it('never mixes currencies and counts the ones left out', () => {
    expect(mainCurrency(all, TODAY)).toBe('EUR');
    expect(otherCurrencyCount(all, TODAY, 'EUR')).toBe(1);
    expect(costShares(all, TODAY, 'category', 'USD')).toEqual([
      { id: 'software', label: 'software', value: 500 },
    ]);
    expect(mainCurrency([usd], TODAY)).toBe('USD');
    expect(mainCurrency([paused], TODAY)).toBeUndefined();
  });
});

describe('upcoming charges (30 days)', () => {
  it('lists every charge of active subscriptions from today on, by date', () => {
    const weekly = sub({
      name: 'Box',
      amountMinor: 500,
      startDate: '2026-11-16',
      recurrence: { freq: 'weekly' },
    });
    const monthly = sub({ name: 'Video', startDate: '2026-01-15' });
    const yearly = sub({ name: 'Jahr', startDate: '2025-03-01', recurrence: { freq: 'yearly' } });
    const paused = sub({ name: 'Pause', startDate: '2026-01-16', active: false });
    const list = upcomingCharges([weekly, monthly, yearly, paused], TODAY);
    expect(list.map((c) => `${c.date} ${c.name}`)).toEqual([
      '2026-11-15 Video',
      '2026-11-16 Box',
      '2026-11-23 Box',
      '2026-11-30 Box',
      '2026-12-07 Box',
      '2026-12-14 Box',
    ]);
    // Day 30 is the 14 Dec (today counts); the monthly charge on the 15 Dec is outside.
    expect(byDay(list).map((g) => g.items.length)).toEqual([1, 1, 1, 1, 1, 1]);
    expect([...sumByCurrency(list)]).toEqual([['EUR', 1200 + 5 * 500]]);
  });

  it('sums each currency on its own, the euro first', () => {
    const sums = sumByCurrency([
      { amountMinor: 100, currency: 'USD' },
      { amountMinor: 200, currency: 'EUR' },
      { amountMinor: 50, currency: 'CHF' },
      { amountMinor: 300, currency: 'EUR' },
    ]);
    expect([...sums]).toEqual([
      ['EUR', 500],
      ['CHF', 50],
      ['USD', 100],
    ]);
  });

  it('groups charges of the same day', () => {
    expect(byDay([{ date: '1' }, { date: '1' }, { date: '2' }]).map((g) => g.items.length)).toEqual(
      [2, 1],
    );
  });
});

describe('yearly ranking and list sort', () => {
  const cheap = sub({ name: 'Billig', amountMinor: 300 });
  const dear = sub({ name: 'Teuer', amountMinor: 2990 });
  const weekly = sub({ name: 'Woche', amountMinor: 500, recurrence: { freq: 'weekly' } });
  const yearly = sub({ name: 'Jahr', amountMinor: 6900, recurrence: { freq: 'yearly' } });
  const paused = sub({ name: 'Aaa pausiert', amountMinor: 99999, active: false });
  const usd = sub({ name: 'Dollar', amountMinor: 99999, currency: 'USD' });
  const list = [cheap, dear, weekly, yearly, paused, usd];

  it('ranks what a subscription costs in a year', () => {
    expect(yearlyRanking(list, TODAY, 'EUR').map((r) => [r.sub.name, r.yearly])).toEqual([
      ['Teuer', 35880],
      ['Woche', 26000],
      ['Jahr', 6900],
      ['Billig', 3600],
    ]);
  });

  it('sorts by cost per year with paused ones last and other currencies after the euro', () => {
    expect(sortList(list, TODAY, 'cost').map((s) => s.name)).toEqual([
      'Teuer',
      'Woche',
      'Jahr',
      'Billig',
      'Dollar',
      'Aaa pausiert',
    ]);
  });

  it('sorts by name with paused ones last', () => {
    expect(sortList(list, TODAY, 'name').map((s) => s.name)).toEqual([
      'Billig',
      'Dollar',
      'Jahr',
      'Teuer',
      'Woche',
      'Aaa pausiert',
    ]);
  });

  it('accepts only known sort keys from the URL', () => {
    expect(isSortKey('cost')).toBe(true);
    expect(isSortKey('price')).toBe(false);
    expect(isSortKey(null)).toBe(false);
  });
});
