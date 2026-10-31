import { describe, expect, it } from 'vitest';
import { findRule, normalizePayee, proposeRules, type BankRule } from './rules';

describe('normalizePayee', () => {
  it('ignores case, umlauts, punctuation and reference numbers', () => {
    expect(normalizePayee('NETFLIX International B.V. 4711')).toBe('netflix international b v');
    expect(normalizePayee('Bäckerei Müller-Söhne')).toBe('backerei muller sohne');
    expect(normalizePayee('  ')).toBe('');
  });
});

describe('findRule', () => {
  const rules: BankRule[] = [
    { id: 'a', match: 'netflix', categoryId: 'c1' },
    { id: 'b', match: 'netflix international', categoryId: 'c2' },
  ];
  it('matches on word boundaries, normalized', () => {
    expect(findRule(rules, { payee: 'NETFLIX.COM' })?.id).toBe('a');
    expect(findRule(rules, { payee: 'Netflixx' })).toBeUndefined();
    expect(findRule(rules, { payee: 'Mein netflix-konto' })?.id).toBe('a');
  });
  it('prefers the most specific pattern', () => {
    expect(findRule(rules, { payee: 'Netflix International B.V.' })?.id).toBe('b');
  });
  it('falls back to the purpose only when there is no payee', () => {
    expect(findRule(rules, { payee: '', purpose: 'Netflix Oktober' })?.id).toBe('a');
    expect(findRule(rules, { payee: 'Kiosk', purpose: 'Netflix Oktober' })).toBeUndefined();
  });
});

const base = {
  rules: [] as BankRule[],
  subscriptions: [{ id: 's1', name: 'Netflix' }],
  providerNames: ['Spotify', 'Disney+'],
  past: [] as { payee?: string; kind: 'expense' | 'income'; categoryId?: string }[],
  subscriptionCategoryId: 'cat-subs',
  categoryIds: new Set(['cat-subs', 'cat-food']),
};

describe('proposeRules', () => {
  it('proposes subscription and category for a payee that contains a subscription of the user', () => {
    const p = proposeRules({
      ...base,
      bookings: [{ payee: 'Netflix International B.V.', kind: 'expense' }],
    });
    expect(p).toEqual([
      {
        match: 'netflix',
        payee: 'Netflix International B.V.',
        subscriptionId: 's1',
        subscriptionName: 'Netflix',
        categoryId: 'cat-subs',
      },
    ]);
  });

  it('uses the shipped provider names, with the category only', () => {
    const p = proposeRules({ ...base, bookings: [{ payee: 'SPOTIFY AB', kind: 'expense' }] });
    expect(p).toEqual([{ match: 'spotify', payee: 'SPOTIFY AB', categoryId: 'cat-subs' }]);
  });

  it('proposes a category an earlier payee shared at least twice', () => {
    const past = [
      { payee: 'Marktkauf', kind: 'expense' as const, categoryId: 'cat-food' },
      { payee: 'MARKTKAUF', kind: 'expense' as const, categoryId: 'cat-food' },
    ];
    const bookings = [{ payee: 'Marktkauf', kind: 'expense' as const }];
    expect(proposeRules({ ...base, past, bookings })).toEqual([
      { match: 'marktkauf', payee: 'Marktkauf', categoryId: 'cat-food' },
    ]);
    expect(proposeRules({ ...base, past: past.slice(0, 1), bookings })).toEqual([]);
  });

  it('never proposes for income as a subscription, for known rules, or twice for one payee', () => {
    expect(
      proposeRules({ ...base, bookings: [{ payee: 'Netflix refund', kind: 'income' }] }),
    ).toEqual([]);
    expect(
      proposeRules({
        ...base,
        rules: [{ id: 'r', match: 'netflix', categoryId: 'cat-subs' }],
        bookings: [{ payee: 'Netflix International', kind: 'expense' }],
      }),
    ).toEqual([]);
    const twice = proposeRules({
      ...base,
      bookings: [
        { payee: 'Netflix', kind: 'expense' },
        { payee: 'NETFLIX 123', kind: 'expense' },
      ],
    });
    expect(twice).toHaveLength(1);
  });

  it('leaves out a category that no longer exists and caps the list', () => {
    expect(
      proposeRules({
        ...base,
        categoryIds: new Set(),
        bookings: [{ payee: 'Spotify', kind: 'expense' }],
      }),
    ).toEqual([]);
    const many = [
      'Spotify',
      'Disney+ a',
      'Netflix x',
      'Disney+ b',
      'Disney+ c',
      'Disney+ d',
      'Disney+ e',
    ].map((payee) => ({ payee, kind: 'expense' as const }));
    expect(proposeRules({ ...base, bookings: many }).length).toBeLessThanOrEqual(5);
  });
});
