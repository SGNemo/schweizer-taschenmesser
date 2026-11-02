import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import headline from '../headline';
import { accountRepo, transactionRepo } from '../repo';

beforeEach(async () => {
  for (const t of ['finance_account', 'finance_transaction']) await db.table(t).clear();
});

describe('finance headline (cockpit)', () => {
  it('is empty without accounts, else the balance of all accounts with the account count', async () => {
    expect(await headline({ today: '2026-11-02' })).toBeUndefined();
    const a = await accountRepo.create({ name: 'Giro', openingBalanceMinor: 100_000, order: 0 });
    const b = await accountRepo.create({ name: 'Sparen', openingBalanceMinor: 50_000, order: 1 });
    await transactionRepo.create({
      accountId: a.id,
      kind: 'expense',
      amountMinor: 2_500,
      date: '2026-11-01',
    });
    await transactionRepo.create({
      accountId: b.id,
      kind: 'income',
      amountMinor: 1_000,
      date: '2026-11-02',
    });
    const figure = await headline({ today: '2026-11-02' });
    expect(figure?.label).toBe('Kontostand');
    expect(figure?.value).toMatch(/1\.485,00/);
    expect(figure?.detail).toBe('2 Konten');
    expect(figure?.to).toBe('/finance');
  });
});
