/**
 * Bookings ↔ subscriptions (pure). A changed price shows up in the bank bookings before anyone edits
 * the subscription: when the two newest bookings of a subscription agree on an amount that differs
 * from the stored price, finance offers the new price. One odd booking never counts.
 */
import { addDaysStr, daysBetween } from '@/core/time/dates';
import { normalizePayee } from './rules';

export interface SubscriptionPrice {
  id: string;
  name: string;
  amountMinor: number;
  currency: string;
}

export interface BookingLike {
  accountId: string;
  kind: 'expense' | 'income';
  amountMinor: number;
  date: string;
  payee?: string;
  transferId?: string;
}

/** Does the payee name the service ("NETFLIX.COM 8812" contains "Netflix")? Whole words, accents and case ignored. */
export function payeeMatches(payee: string | undefined, name: string): boolean {
  const p = normalizePayee(payee ?? '');
  const n = normalizePayee(name);
  return n !== '' && ` ${p} `.includes(` ${n} `);
}

export interface PriceChange {
  subscriptionId: string;
  name: string;
  /** The stored price. */
  fromMinor: number;
  /** What the last two bookings show. */
  toMinor: number;
  /** Date of the older of the two bookings. */
  since: string;
  currency: string;
}

/** `windowDays`: only bookings of this many days back count (a price seen long ago is history). */
export function detectPriceChanges(input: {
  subscriptions: readonly SubscriptionPrice[];
  bookings: readonly BookingLike[];
  accountCurrency: ReadonlyMap<string, string>;
  today: string;
  windowDays?: number;
}): PriceChange[] {
  const since = addDaysStr(input.today, -(input.windowDays ?? 120));
  const out: PriceChange[] = [];
  for (const sub of input.subscriptions) {
    const hits = input.bookings
      .filter(
        (b) =>
          b.kind === 'expense' &&
          !b.transferId &&
          b.date >= since &&
          b.date <= input.today &&
          input.accountCurrency.get(b.accountId) === sub.currency &&
          payeeMatches(b.payee, sub.name),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
    const [latest, previous] = hits;
    if (!latest || !previous) continue;
    if (latest.amountMinor !== previous.amountMinor) continue;
    if (latest.amountMinor === sub.amountMinor) continue;
    out.push({
      subscriptionId: sub.id,
      name: sub.name,
      fromMinor: sub.amountMinor,
      toMinor: latest.amountMinor,
      since: previous.date,
      currency: sub.currency,
    });
  }
  return out;
}

/**
 * A booking that already stands for this charge: same service, same amount, within `days` days
 * (an imported bank line, a repeating booking). Booking the charge again would count it twice.
 */
export function chargeAlreadyBooked(
  charge: { name: string; amountMinor: number; date: string },
  bookings: readonly BookingLike[],
  days = 3,
): boolean {
  return bookings.some(
    (b) =>
      b.kind === 'expense' &&
      !b.transferId &&
      b.amountMinor === charge.amountMinor &&
      Math.abs(daysBetween(charge.date, b.date)) <= days &&
      payeeMatches(b.payee, charge.name),
  );
}
