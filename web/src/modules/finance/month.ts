/**
 * "Diesen Monat" in three rough numbers: what is still coming until the end of the month (fixed:
 * subscription charges after today, open invoices due this month), what was spent so far
 * (variable: expenses booked this month, no transfers) and what is left free (balance minus what
 * is coming). Pure; the widget passes the data in.
 */
import { endOfMonthStr } from '@/core/time/dates';
import type { Transaction } from './schema';

export interface MonthGlance {
  /** Balance today minus everything still coming this month. */
  freeMinor: number;
  comingMinor: number;
  comingCount: number;
  spentMinor: number;
}

export function monthGlance(input: {
  balanceMinor: number;
  today: string;
  txs: readonly Pick<Transaction, 'kind' | 'amountMinor' | 'date' | 'transferId'>[];
  /** Subscription charges (a charge on `today` counts as booked already). */
  charges: readonly { date: string; amountMinor: number }[];
  /** Open invoices; overdue ones still have to be paid, so they count too. */
  invoices: readonly { dueDate: string; amountMinor: number }[];
}): MonthGlance {
  const { today } = input;
  const end = endOfMonthStr(today);
  const month = today.slice(0, 7);
  const coming = [
    ...input.charges.filter((c) => c.date > today && c.date <= end),
    ...input.invoices.filter((i) => i.dueDate <= end),
  ];
  const comingMinor = coming.reduce((n, c) => n + c.amountMinor, 0);
  const spentMinor = input.txs
    .filter(
      (x) => x.kind === 'expense' && !x.transferId && x.date.startsWith(month) && x.date <= today,
    )
    .reduce((n, x) => n + x.amountMinor, 0);
  return {
    freeMinor: input.balanceMinor - comingMinor,
    comingMinor,
    comingCount: coming.length,
    spentMinor,
  };
}
