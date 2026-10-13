import { describe, expect, it } from 'vitest';
import { lastUsedFor } from '../logic';

const tx = (over: Partial<Parameters<typeof lastUsedFor>[0][number]>) => ({
  accountId: 'a1',
  categoryId: 'c1',
  kind: 'expense' as const,
  amountMinor: 100,
  date: '2026-09-01',
  createdAt: 1,
  payee: 'Migros',
  ...over,
});

describe('lastUsedFor', () => {
  it('returns the category and account of the newest booking of the payee', () => {
    const txs = [
      tx({ categoryId: 'old', date: '2026-08-01' }),
      tx({ categoryId: 'food', accountId: 'a2', date: '2026-09-15' }),
      tx({ categoryId: 'other', payee: 'Coop' }),
    ];
    expect(lastUsedFor(txs, 'Migros', 'expense')).toEqual({ categoryId: 'food', accountId: 'a2' });
  });
  it('ignores case and surrounding spaces, and the other kind', () => {
    const txs = [tx({ kind: 'income', categoryId: 'salary' }), tx({ categoryId: 'food' })];
    expect(lastUsedFor(txs, '  migros ', 'expense')?.categoryId).toBe('food');
    expect(lastUsedFor(txs, 'Migros', 'income')?.categoryId).toBe('salary');
  });
  it('breaks ties on the same day by creation time', () => {
    const txs = [
      tx({ categoryId: 'first', createdAt: 1 }),
      tx({ categoryId: 'second', createdAt: 2 }),
    ];
    expect(lastUsedFor(txs, 'Migros', 'expense')?.categoryId).toBe('second');
  });
  it('knows nothing about an unknown or empty payee', () => {
    expect(lastUsedFor([tx({})], 'Kiosk', 'expense')).toBeUndefined();
    expect(lastUsedFor([tx({})], '  ', 'expense')).toBeUndefined();
  });
});
