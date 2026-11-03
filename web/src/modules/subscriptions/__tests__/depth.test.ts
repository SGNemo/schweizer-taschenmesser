import { describe, expect, it } from 'vitest';
import {
  monogram,
  monthlyEquivalent,
  paletteIndex,
  subscriptionStatus,
  topExpensive,
  trialDaysLeft,
} from '../logic';
import { subscriptionSchema } from '../schema';

const sub = (over: Record<string, unknown> = {}) =>
  subscriptionSchema.parse({
    name: 'Streaming Plus',
    amountMinor: 1299,
    recurrence: { freq: 'monthly', interval: 1 },
    startDate: '2026-01-15',
    ...over,
  });

describe('monthly equivalent (expectation table)', () => {
  const rows: [string, number, Record<string, unknown>, number][] = [
    ['monthly stays', 1299, { freq: 'monthly', interval: 1 }, 1299],
    ['yearly / 12 exact', 11988, { freq: 'yearly', interval: 1 }, 999],
    ['yearly rounds half up (166.58)', 1999, { freq: 'yearly', interval: 1 }, 167],
    ['quarterly (999.67)', 2999, { freq: 'monthly', interval: 3 }, 1000],
    ['every 2 months', 1000, { freq: 'monthly', interval: 2 }, 500],
    ['weekly (2166.67)', 500, { freq: 'weekly', interval: 1 }, 2167],
    ['every 3 weeks (1300)', 900, { freq: 'weekly', interval: 3 }, 1300],
    [
      'two weekdays a week (104 charges)',
      300,
      { freq: 'weekly', interval: 1, byWeekday: [1, 4] },
      2600,
    ],
    ['daily (3041.67)', 100, { freq: 'daily', interval: 1 }, 3042],
    ['every two years', 24000, { freq: 'yearly', interval: 2 }, 1000],
  ];
  it.each(rows)('%s', (_n, amountMinor, recurrence, expected) => {
    expect(monthlyEquivalent({ amountMinor, recurrence } as never)).toBe(expected);
  });
});

describe('status (expectation table)', () => {
  const day = '2026-03-10';
  const rows: [string, Record<string, unknown>, string][] = [
    ['running', {}, 'active'],
    ['switched off', { active: false }, 'paused'],
    ['trial ends today still counts as trial', { trialEndsOn: '2026-03-10' }, 'trial'],
    ['trial ended yesterday', { trialEndsOn: '2026-03-09' }, 'active'],
    [
      'cancelled "zum" a date that is ahead',
      { recurrence: { freq: 'monthly', interval: 1, until: '2026-04-15' } },
      'cancelled',
    ],
    [
      'last day is today',
      { recurrence: { freq: 'monthly', interval: 1, until: '2026-03-10' } },
      'cancelled',
    ],
    [
      'last day is behind',
      { recurrence: { freq: 'monthly', interval: 1, until: '2026-03-09' } },
      'ended',
    ],
    ['paused beats trial', { active: false, trialEndsOn: '2026-04-01' }, 'paused'],
  ];
  it.each(rows)('%s', (_n, over, expected) => {
    expect(subscriptionStatus(sub(over), day)).toBe(expected);
  });

  it('counts the days left in a trial', () => {
    expect(trialDaysLeft({ trialEndsOn: '2026-03-13' }, '2026-03-10')).toBe(3);
    expect(trialDaysLeft({ trialEndsOn: '2026-03-10' }, '2026-03-10')).toBe(0);
    expect(trialDaysLeft({ trialEndsOn: '2026-03-09' }, '2026-03-10')).toBeUndefined();
    expect(trialDaysLeft({}, '2026-03-10')).toBeUndefined();
  });
});

describe('most expensive', () => {
  const list = [
    sub({ name: 'Cheap', amountMinor: 399 }),
    sub({ name: 'Year', amountMinor: 9900, recurrence: { freq: 'yearly', interval: 1 } }), // 99/yr
    sub({ name: 'Big', amountMinor: 1999 }), // 239.88/yr
    sub({ name: 'Paused', amountMinor: 99999, active: false }),
    sub({ name: 'Dollar', amountMinor: 50000, currency: 'USD' }),
    sub({
      name: 'Ended',
      amountMinor: 88888,
      recurrence: { freq: 'monthly', interval: 1, until: '2026-01-01' },
    }),
  ];
  it('ranks running ones by yearly cost in the main currency only', () => {
    expect(topExpensive(list, '2026-03-10', 3).map((s) => s.name)).toEqual([
      'Big',
      'Year',
      'Cheap',
    ]);
    expect(topExpensive(list, '2026-03-10', 1)).toHaveLength(1);
  });
  it('ties break by name', () => {
    const t = [sub({ name: 'B' }), sub({ name: 'A' })];
    expect(topExpensive(t, '2026-03-10').map((s) => s.name)).toEqual(['A', 'B']);
  });
});

describe('service tile helpers', () => {
  it.each([
    ['Streaming Plus', 'SP'],
    ['Spotify', 'S'],
    ['  netflix  ', 'N'],
    ['Disney+ Family Plan', 'DF'],
    ['Éclair-Abo', 'ÉA'],
    ['123 Fitness', '1F'],
    ['+++', '?'],
    ['', '?'],
  ])('monogram(%j) = %s', (name, expected) => expect(monogram(name)).toBe(expected));

  it('the same name always picks the same palette entry, inside the palette', () => {
    expect(paletteIndex('Netflix', 10)).toBe(paletteIndex(' netflix ', 10));
    for (const n of ['a', 'Spotify', 'Streaming Plus', 'Ünïcödé', '']) {
      const i = paletteIndex(n, 10);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(10);
    }
    expect(paletteIndex('x', 0)).toBe(0);
  });
});
