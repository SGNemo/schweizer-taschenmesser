import { currencyOf, formatMoney } from '@/core/money';
import type { AttentionSource } from '@/core/modules/types';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
// Sanctioned cross-module read access (see CLAUDE.md): finance → subscriptions/public.
import { listSubscriptionPrices, priceHintOn } from '@/modules/subscriptions/public';
import { accountRepo, transactionRepo } from './repo';
import { detectPriceChanges } from './subscriptionLink';

/**
 * One calm notice per subscription whose bookings show another price than the one stored ("Streaming
 * Plus bucht jetzt 14,99 € statt 12,99 €"). It opens the subscription with the new price offered;
 * nothing changes by itself. Off with the subscriptions setting "Preisänderung melden".
 */
const source: AttentionSource = async ({ today }) => {
  if (!(await priceHintOn())) return [];
  const subscriptions = await listSubscriptionPrices();
  if (subscriptions.length === 0) return [];
  const [accounts, bookings] = await Promise.all([
    accountRepo.active().toArray(),
    transactionRepo.active().toArray(),
  ]);
  const changes = detectPriceChanges({
    subscriptions,
    bookings,
    accountCurrency: new Map(accounts.map((a) => [a.id, currencyOf(a)])),
    today,
  });
  return changes.map((c) => ({
    id: `finance:subscription-price:${c.subscriptionId}:${c.toMinor}`,
    tone: 'accent' as const,
    icon: 'repeat' as const,
    title: t.finance.ext.subPrice.title(
      c.name,
      formatMoney(c.fromMinor, c.currency),
      formatMoney(c.toMinor, c.currency),
    ),
    detail: t.finance.ext.subPrice.detail(formatDay(c.since, 'd. MMM')),
    to: `/subscriptions?open=${c.subscriptionId}&newprice=${c.toMinor}`,
    rank: 2,
  }));
};

export default source;
