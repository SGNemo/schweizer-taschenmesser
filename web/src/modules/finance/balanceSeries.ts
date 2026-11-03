import { addDaysStr, monthOf } from '@/core/time/dates';
import { balances, signed } from './logic';
import type { Account, Transaction } from './schema';

type Tx = Pick<Transaction, 'accountId' | 'categoryId' | 'kind' | 'amountMinor' | 'date'>;

export interface DayPoint {
  date: string;
  balanceMinor: number;
}

/**
 * Balance of the given accounts at the end of each day of `month` (up to `through`, so the running month stops today):
 * the sum over the accounts, opening balance and every booking up to that day. Pure; the month curve of the finance head.
 */
export function monthBalanceSeries(
  accounts: (Pick<Account, 'openingBalanceMinor'> & { id: string })[],
  txs: Tx[],
  month: string,
  through: string,
): DayPoint[] {
  const first = `${month}-01`;
  const before = addDaysStr(first, -1);
  let running = [...balances(accounts, txs, before).values()].reduce((s, v) => s + v, 0);
  const ids = new Set(accounts.map((a) => a.id));
  const perDay = new Map<string, number>();
  for (const t of txs) {
    if (!ids.has(t.accountId) || monthOf(t.date) !== month) continue;
    perDay.set(t.date, (perDay.get(t.date) ?? 0) + signed(t));
  }
  const points: DayPoint[] = [{ date: before, balanceMinor: running }];
  for (let d = first; monthOf(d) === month && d <= through; d = addDaysStr(d, 1)) {
    running += perDay.get(d) ?? 0;
    points.push({ date: d, balanceMinor: running });
  }
  return points;
}
