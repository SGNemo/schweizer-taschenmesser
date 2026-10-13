import { describe, expect, it } from 'vitest';
import { filterTransactions } from '../logic';

const tx = (over: Record<string, unknown>) => ({
  accountId: 'a1',
  categoryId: undefined as string | undefined,
  kind: 'expense' as const,
  amountMinor: 1000,
  date: '2026-09-01',
  payee: undefined as string | undefined,
  note: undefined as string | undefined,
  ...over,
});
const name = (id: string | undefined) => ({ food: 'Lebensmittel', fun: 'Freizeit' })[id ?? ''];

const list = [
  tx({ payee: 'Migros', categoryId: 'food', amountMinor: 4500 }),
  tx({ payee: 'Kino Ärgernis', categoryId: 'fun', amountMinor: 1850, date: '2026-08-14' }),
  tx({ payee: 'Arbeitgeber', kind: 'income', amountMinor: 520000, note: 'Gehalt Oktober' }),
];

describe('filterTransactions', () => {
  it('returns everything without a query and for kind "all"', () => {
    expect(filterTransactions(list, { query: '', kind: 'all' }, name)).toHaveLength(3);
  });
  it('matches payee, note, category and amount, ignoring case and diacritics', () => {
    const q = (query: string) =>
      filterTransactions(list, { query, kind: 'all' }, name).map((x) => x.payee);
    expect(q('migros')).toEqual(['Migros']);
    expect(q('argernis')).toEqual(['Kino Ärgernis']);
    expect(q('gehalt')).toEqual(['Arbeitgeber']);
    expect(q('freizeit')).toEqual(['Kino Ärgernis']);
    expect(q('45,00')).toEqual(['Migros']);
  });
  it('needs every word, in any order', () => {
    expect(filterTransactions(list, { query: 'oktober gehalt', kind: 'all' }, name)).toHaveLength(
      1,
    );
    expect(filterTransactions(list, { query: 'migros kino', kind: 'all' }, name)).toHaveLength(0);
  });
  it('filters by kind and combines it with the text', () => {
    expect(filterTransactions(list, { query: '', kind: 'income' }, name)).toHaveLength(1);
    expect(filterTransactions(list, { query: 'migros', kind: 'income' }, name)).toHaveLength(0);
  });
});
