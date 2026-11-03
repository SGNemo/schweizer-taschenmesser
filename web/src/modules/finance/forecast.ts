/**
 * Cashflow forecast: today's balance plus what is already known to come – repeating bookings,
 * subscription charges, open invoices. Pure; the caller passes the data in. Nothing is guessed
 * from the past, so the line only contains things the user entered.
 */
import { addDaysStr, endOfMonthStr } from '@/core/time/dates';
import { nextRepeatDate } from './logic';
import type { Transaction } from './schema';

export type ForecastSource = 'repeat' | 'subscription' | 'invoice';

export interface ForecastEvent {
  date: string;
  /** Signed: income positive, expense negative. */
  amountMinor: number;
  label: string;
  source: ForecastSource;
}

export interface ForecastPoint {
  date: string;
  balanceMinor: number;
}

export interface Forecast {
  events: ForecastEvent[];
  /** Start point plus one point per day with events, oldest first. */
  points: ForecastPoint[];
  lowest: ForecastPoint;
  end: ForecastPoint;
}

export type ForecastHorizon = 'month' | '30' | '90';

/** The last day of the forecast for a horizon setting. */
export function horizonEnd(today: string, horizon: ForecastHorizon): string {
  return horizon === 'month' ? endOfMonthStr(today) : addDaysStr(today, horizon === '30' ? 30 : 90);
}

const key = (s: string | undefined) => (s ?? '').trim().toLocaleLowerCase();
const signedOf = (t: Pick<Transaction, 'kind' | 'amountMinor'>) =>
  t.kind === 'income' ? t.amountMinor : -t.amountMinor;

export interface ForecastInput {
  /** Balance of the accounts in the shown currency as of `today`. */
  balanceMinor: number;
  today: string;
  to: string;
  /** Newest booking of each repeating series (`repeat` set). */
  repeatHeads: readonly Pick<Transaction, 'kind' | 'amountMinor' | 'date' | 'payee' | 'repeat'>[];
  subscriptionCharges: readonly { date: string; amountMinor: number; name: string }[];
  openInvoices: readonly { dueDate: string; amountMinor: number; payee: string }[];
}

/** At most this many occurrences per series are expanded (a weekly series over 90 days is 13). */
const MAX_PER_SERIES = 60;

export function buildForecast(input: ForecastInput): Forecast {
  const { today, to } = input;
  const events: ForecastEvent[] = [];

  for (const head of input.repeatHeads) {
    if (!head.repeat) continue;
    let date = head.date;
    for (let i = 0; i < MAX_PER_SERIES; i++) {
      date = nextRepeatDate(date, head.repeat);
      if (date > to) break;
      // A missed occurrence is booked at the next start; until then it lands on today.
      events.push({
        date: date < today ? today : date,
        amountMinor: signedOf(head),
        label: head.payee ?? '',
        source: 'repeat',
      });
    }
  }

  // A subscription that is also a repeating booking (same payee and amount) is counted once.
  const covered = new Set(
    input.repeatHeads.filter((h) => h.kind === 'expense').map((h) => `${key(h.payee)}|${h.amountMinor}`),
  );
  for (const c of input.subscriptionCharges) {
    if (c.date > to || covered.has(`${key(c.name)}|${c.amountMinor}`)) continue;
    events.push({
      date: c.date < today ? today : c.date,
      amountMinor: -c.amountMinor,
      label: c.name,
      source: 'subscription',
    });
  }

  for (const inv of input.openInvoices) {
    if (inv.dueDate > to) continue;
    events.push({
      date: inv.dueDate < today ? today : inv.dueDate,
      amountMinor: -inv.amountMinor,
      label: inv.payee,
      source: 'invoice',
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.amountMinor - b.amountMinor);

  const points: ForecastPoint[] = [{ date: today, balanceMinor: input.balanceMinor }];
  let balance = input.balanceMinor;
  for (const e of events) {
    balance += e.amountMinor;
    const last = points[points.length - 1]!;
    // Events of one day share a point; the start point stays as it is (it is the balance before them).
    if (last.date === e.date && points.length > 1) last.balanceMinor = balance;
    else points.push({ date: e.date, balanceMinor: balance });
  }
  const lowest = points.reduce((m, p) => (p.balanceMinor < m.balanceMinor ? p : m), points[0]!);
  return { events, points, lowest, end: { date: to, balanceMinor: balance } };
}
