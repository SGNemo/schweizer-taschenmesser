import { describe, expect, it } from 'vitest';
import { keywordCategory, suggestCategories } from './categoryHints';

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

// B03 (round 5, person B): a first bank import had no category on any row, so a budget for
// groceries stayed at 0 % although the statement was full of supermarket bookings.
describe('keywordCategory', () => {
  it('names a default category for well-known shops, rent, fuel and salary', () => {
    expect(keywordCategory({ payee: 'Rewe Markt Müllerstraße', kind: 'expense' })).toBe('cat-food');
    expect(keywordCategory({ payee: 'Bäckerei Schäfer', kind: 'expense' })).toBe('cat-food');
    expect(keywordCategory({ payee: 'X', purpose: 'Einkauf Lebensmittel', kind: 'expense' })).toBe(
      'cat-food',
    );
    expect(keywordCategory({ payee: 'Hausverwaltung Grün', kind: 'expense' })).toBe('cat-home');
    expect(keywordCategory({ payee: 'Stadtwerke Musterstadt', kind: 'expense' })).toBe('cat-home');
    expect(keywordCategory({ payee: 'Aral Station', kind: 'expense' })).toBe('cat-mobility');
    expect(keywordCategory({ payee: 'Firma', purpose: 'Gehalt Oktober', kind: 'income' })).toBe(
      'cat-salary',
    );
  });

  it('stays quiet when unsure: other direction, parts of words, unknown payees', () => {
    expect(keywordCategory({ payee: 'Rewe Markt', kind: 'income' })).toBeUndefined();
    expect(keywordCategory({ payee: 'Gasthaus Linde', kind: 'expense' })).toBeUndefined();
    expect(keywordCategory({ payee: 'Elektro Möller', kind: 'expense' })).toBeUndefined();
    expect(keywordCategory({ kind: 'expense' })).toBeUndefined();
  });
});
