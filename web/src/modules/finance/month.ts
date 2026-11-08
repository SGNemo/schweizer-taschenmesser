/**
 * "Diesen Monat" in three rough numbers, from the month outlook (`buildForecast`, horizon
 * 'month'): what is still coming until the month ends (outgoing events: subscriptions, open
 * invoices, repeating bookings), what was spent so far (expenses booked this month, no transfers)
 * and what stays free (the outlook's balance at the month's end). Pure.
 */
import type { Forecast } from './forecast';
import type { Transaction } from './schema';

export interface MonthGlance {
  freeMinor: number;
  comingMinor: number;
  comingCount: number;
  spentMinor: number;
}

export function monthGlance(input: {
  forecast: Pick<Forecast, 'events' | 'end'>;
  today: string;
  txs: readonly Pick<Transaction, 'kind' | 'amountMinor' | 'date' | 'transferId'>[];
}): MonthGlance {
  const { today } = input;
  const month = today.slice(0, 7);
  const out = input.forecast.events.filter((e) => e.amountMinor < 0);
  const spentMinor = input.txs
    .filter(
      (x) => x.kind === 'expense' && !x.transferId && x.date.startsWith(month) && x.date <= today,
    )
    .reduce((n, x) => n + x.amountMinor, 0);
  return {
    freeMinor: input.forecast.end.balanceMinor,
    comingMinor: -out.reduce((n, e) => n + e.amountMinor, 0),
    comingCount: out.length,
    spentMinor,
  };
}
