import { useLiveQuery } from 'dexie-react-hooks';
import { formatMoney } from '@/core/money';
import { formatDay, today } from '@/core/time/dates';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { nextCharge, sortSubscriptions, totals } from '../logic';
import { subscriptionRepo } from '../repo';

export default function NextChargesWidget() {
  const subs = useLiveQuery(
    async () => (await subscriptionRepo.active().toArray()).filter((s) => s.active),
    [],
  );
  const day = today();
  return (
    <WidgetList
      loading={!subs}
      empty={t.subscriptions.widgetEmpty}
      headline={subs && subs.length > 0 ? formatMoney(totals(subs).monthly) : undefined}
      subline={subs && subs.length > 0 ? t.subscriptions.perMonthShort : undefined}
      entries={sortSubscriptions(subs ?? [], day)
        .slice(0, 4)
        .map((s) => {
          const charge = nextCharge(s, day);
          return {
            key: s.id,
            title: s.name,
            meta: `${charge ? formatDay(charge, 'd. MMM') : '–'} · ${formatMoney(s.amountMinor)}`,
          };
        })}
      to="/subscriptions"
      linkLabel={t.subscriptions.title}
    />
  );
}
