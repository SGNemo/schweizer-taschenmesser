/**
 * Read-only API for modules that are allowed to look at subscriptions (finance).
 */
import { subscriptionRepo } from './repo';
import { chargesInRange, totals } from './logic';

export interface SubscriptionCharge {
  subscriptionId: string;
  name: string;
  amountMinor: number;
  /** 'YYYY-MM-DD' */
  date: string;
}

/** Expected charges of active subscriptions within [from, to], ordered by date. */
export async function listSubscriptionCharges(
  from: string,
  to: string,
): Promise<SubscriptionCharge[]> {
  const subs = (await subscriptionRepo.active().toArray()).filter((s) => s.active);
  return subs
    .flatMap((s) =>
      chargesInRange(s, from, to).map((date) => ({
        subscriptionId: s.id,
        name: s.name,
        amountMinor: s.amountMinor,
        date,
      })),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'de'));
}

/** Monthly and yearly cost of all active subscriptions (cents). */
export async function subscriptionTotals(): Promise<{ monthly: number; yearly: number }> {
  return totals(await subscriptionRepo.active().toArray());
}
