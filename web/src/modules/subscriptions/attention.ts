import { getMeta, setMeta } from '@/core/db/metaKv';
import { currencyOf, formatMoney } from '@/core/money';
import { getSettings } from '@/core/settings/settings';
import { daysBetween, formatDay } from '@/core/time/dates';
import type { AttentionSource } from '@/core/modules/types';
import { t } from '@/strings';
import { recentIncrease } from './logic';
import { subscriptionRepo } from './repo';
import { settings } from './settings';

/** `_meta`: per price rise the day it was first noticed (`<subscription id>:<date>` → 'YYYY-MM-DD'). */
export const PRICE_HINTS_KEY = 'subscriptions.priceHints';
/** A rise older than this is history, not news: it is never announced. */
const FRESH_DAYS = 30;
/** A noticed rise stays under "Jetzt wichtig" this many days, then never comes back. */
const SHOW_DAYS = 3;

/**
 * One calm notice per price rise ("Netflix kostet jetzt 14,99 € statt 12,99 €"): shown from the day
 * the app first sees it for a few days, never again afterwards, off with the subscriptions setting.
 * Not red: it is information, not a deadline.
 */
const source: AttentionSource = async ({ today }) => {
  const prefs = await getSettings('module.subscriptions', settings.schema, settings.defaults);
  if (prefs.priceHint === false) return [];
  const subs = (await subscriptionRepo.active().toArray()).filter((s) => s.active);
  const seen = (await getMeta<Record<string, string>>(PRICE_HINTS_KEY)) ?? {};
  let changed = false;
  const items: Awaited<ReturnType<AttentionSource>> = [];
  for (const sub of subs) {
    const rise = recentIncrease(sub.priceHistory ?? [], today, FRESH_DAYS);
    if (!rise) continue;
    const key = `${sub.id}:${rise.date}`;
    if (!seen[key]) {
      seen[key] = today;
      changed = true;
    }
    if (daysBetween(seen[key]!, today) >= SHOW_DAYS) continue;
    const currency = currencyOf(sub);
    items.push({
      id: `subscriptions:price:${key}`,
      tone: 'accent',
      icon: 'repeat',
      title: t.attention.subscriptionPrice(
        sub.name,
        formatMoney(rise.fromMinor, currency),
        formatMoney(rise.toMinor, currency),
      ),
      detail: t.attention.subscriptionPriceSince(formatDay(rise.date, 'd. MMM')),
      to: '/subscriptions',
      rank: 2,
    });
  }
  if (changed) await setMeta(PRICE_HINTS_KEY, seen);
  return items;
};

export default source;
