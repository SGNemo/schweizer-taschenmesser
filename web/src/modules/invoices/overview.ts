import { currencyOf, sumMinor } from '@/core/money';
import { addMonthsToMonth, monthOf } from '@/core/time/dates';
import { paidSum, remainingMinor } from './logic';
import type { Invoice } from './schema';

/** How many months the paid chart and the paid donut look back (the current month included). */
export const OVERVIEW_MONTHS = 12;

type Row = Pick<
  Invoice,
  'payee' | 'amountMinor' | 'currency' | 'dueDate' | 'status' | 'paidAt' | 'payments'
> & { id: string };

/** One payee with its sum, for the donut. */
export interface PayeeSum {
  id: string;
  label: string;
  value: number;
}

export interface InvoiceOverview {
  /** The currency every figure and chart is in: the one most invoices have. */
  currency: string;
  /** Invoices in another currency, left out of every figure here. */
  skipped: number;
  open: { minor: number; count: number };
  /** Open and past their due date (the day after it, like the list). */
  late: { minor: number; count: number };
  /** Paid in the current month: part payments on their day, the rest on the day it was marked paid. */
  paidMonth: { minor: number; count: number };
  /** What is still open, per payee. */
  openByPayee: PayeeSum[];
  /** What was paid in the last `OVERVIEW_MONTHS` months, per payee. */
  paidByPayee: PayeeSum[];
  /** Paid per month, oldest first, `OVERVIEW_MONTHS` entries ending with the current month (`YYYY-MM`). */
  months: { month: string; minor: number }[];
}

/** The money that left for an invoice, with its day: every part payment, then the rest when it was marked paid. */
export function paidFlows(i: Row): { date: string; minor: number }[] {
  const flows = (i.payments ?? []).map((p) => ({ date: p.date, minor: p.amountMinor }));
  if (i.status === 'paid') {
    const rest = Math.max(0, i.amountMinor - paidSum(i));
    if (rest > 0) flows.push({ date: i.paidAt ?? i.dueDate, minor: rest });
  }
  return flows;
}

/** The currency most invoices are in (ties: the one seen first; none: euro). */
export function mainCurrency(list: readonly Pick<Invoice, 'currency'>[]): string {
  const counts = new Map<string, number>();
  for (const i of list) {
    const c = currencyOf(i);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best = currencyOf(null);
  let most = 0;
  for (const [c, n] of counts)
    if (n > most) {
      best = c;
      most = n;
    }
  return best;
}

/** Same payee, whatever the spaces and the case: "Stadtwerke " and "stadtwerke" are one slice. */
const payeeKey = (payee: string) => payee.trim().toLocaleLowerCase();

function byPayee(entries: { payee: string; minor: number }[]): PayeeSum[] {
  const map = new Map<string, PayeeSum>();
  for (const e of entries) {
    if (e.minor <= 0) continue;
    const key = payeeKey(e.payee);
    const cur = map.get(key);
    if (cur) cur.value += e.minor;
    else map.set(key, { id: key, label: e.payee.trim(), value: e.minor });
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

/** Everything the overview tab shows, from the live invoices and today's date. Pure, so it is unit-tested. */
export function invoiceOverview(list: readonly Row[], day: string): InvoiceOverview {
  const currency = mainCurrency(list);
  const mine = list.filter((i) => currencyOf(i) === currency);
  const thisMonth = monthOf(day);
  const firstMonth = addMonthsToMonth(thisMonth, -(OVERVIEW_MONTHS - 1));
  const months = Array.from({ length: OVERVIEW_MONTHS }, (_, n) => ({
    month: addMonthsToMonth(firstMonth, n),
    minor: 0,
  }));
  const monthIndex = new Map(months.map((m, n) => [m.month, n]));

  const open = mine.filter((i) => i.status === 'open' && remainingMinor(i) > 0);
  const late = open.filter((i) => i.dueDate < day);
  const paidInWindow: { payee: string; minor: number }[] = [];
  const paidThisMonth = new Set<string>();
  for (const i of mine)
    for (const f of paidFlows(i)) {
      const n = monthIndex.get(monthOf(f.date));
      if (n === undefined) continue; // older than the window, or (a typo) in the future
      months[n]!.minor += f.minor;
      paidInWindow.push({ payee: i.payee, minor: f.minor });
      if (n === OVERVIEW_MONTHS - 1) paidThisMonth.add(i.id);
    }

  return {
    currency,
    skipped: list.length - mine.length,
    open: { minor: sumMinor(open.map(remainingMinor)), count: open.length },
    late: { minor: sumMinor(late.map(remainingMinor)), count: late.length },
    paidMonth: { minor: months[OVERVIEW_MONTHS - 1]!.minor, count: paidThisMonth.size },
    openByPayee: byPayee(open.map((i) => ({ payee: i.payee, minor: remainingMinor(i) }))),
    paidByPayee: byPayee(paidInWindow),
    months,
  };
}
