/**
 * Read-only API for modules that are allowed to look at subscriptions (finance).
 */
import { compareText } from '@/core/i18n/format';
import { currencyOf, DEFAULT_CURRENCY } from '@/core/money';
import { today } from '@/core/time/dates';
import { getSettings } from '@/core/settings/settings';
import { subscriptionRepo } from './repo';
import { settings } from './settings';
import { chargesInRange, totals } from './logic';

export interface SubscriptionCharge {
  subscriptionId: string;
  name: string;
  amountMinor: number;
  currency: string;
  /** 'YYYY-MM-DD' */
  date: string;
}

/**
 * Expected charges of active subscriptions within [from, to], ordered by date. Only those in
 * `currency` (default euro) are listed: amounts of other currencies are never mixed in.
 */
export async function listSubscriptionCharges(
  from: string,
  to: string,
  currency: string = DEFAULT_CURRENCY,
): Promise<SubscriptionCharge[]> {
  const subs = (await subscriptionRepo.active().toArray()).filter(
    (s) => s.active && currencyOf(s) === currency,
  );
  return subs
    .flatMap((s) =>
      chargesInRange(s, from, to).map((date) => ({
        subscriptionId: s.id,
        name: s.name,
        amountMinor: s.amountMinor,
        currency,
        date,
      })),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || compareText(a.name, b.name));
}

/** Monthly and yearly cost of the active subscriptions in `currency` (default euro), in cents. */
export async function subscriptionTotals(
  currency: string = DEFAULT_CURRENCY,
): Promise<{ monthly: number; yearly: number }> {
  const subs = (await subscriptionRepo.active().toArray()).filter(
    (s) => currencyOf(s) === currency,
  );
  return totals(subs, today());
}

/** Ids and names of the subscriptions, for matching bank bookings to them (finance rules). */
export async function listSubscriptionNames(): Promise<{ id: string; name: string }[]> {
  return (await subscriptionRepo.active().toArray())
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, name: s.name }));
}

/** What a bank booking is compared with to notice a changed price (finance's hint): name, price, currency. */
export async function listSubscriptionPrices(): Promise<
  { id: string; name: string; amountMinor: number; currency: string }[]
> {
  return (await subscriptionRepo.active().toArray())
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, name: s.name, amountMinor: s.amountMinor, currency: currencyOf(s) }));
}

/** Does the user want the price hint (Abos → Einstellungen)? */
export async function priceHintOn(): Promise<boolean> {
  return (
    (await getSettings('module.subscriptions', settings.schema, settings.defaults)).priceHint !==
    false
  );
}
