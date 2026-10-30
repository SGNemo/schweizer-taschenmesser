import { describe, expect, it } from 'vitest';
import { suggestCategories } from './categoryHints';

describe('suggestCategories', () => {
  const past = [
    { payee: 'Hosting AG', kind: 'expense', categoryId: 'ops' },
    { payee: 'hosting  ag', kind: 'expense', categoryId: 'ops' },
    { payee: 'Hosting AG', kind: 'expense', categoryId: 'other' },
    { payee: 'Müller GmbH', kind: 'income', categoryId: 'work' },
    { payee: 'Kiosk', kind: 'expense' },
  ] as const;

  it('takes the category the same payee used most, ignoring case and spacing', () => {
    expect(
      suggestCategories(past, [
        { payee: 'HOSTING AG', kind: 'expense' },
        { payee: 'Müller GmbH', kind: 'income' },
      ]),
    ).toEqual(['ops', 'work']);
  });

  it('suggests nothing for unknown payees, other directions or uncategorised history', () => {
    expect(
      suggestCategories(past, [
        { payee: 'Unbekannt', kind: 'expense' },
        { payee: 'Müller GmbH', kind: 'expense' },
        { payee: 'Kiosk', kind: 'expense' },
        { kind: 'expense' },
      ]),
    ).toEqual([undefined, undefined, undefined, undefined]);
  });
});
