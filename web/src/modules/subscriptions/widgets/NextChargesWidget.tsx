import { useLiveQuery } from 'dexie-react-hooks';
import { currencyOf, formatMoney, formatTotals } from '@/core/money';
import { formatDay, today } from '@/core/time/dates';
import { dueState } from '@/core/time/due';
import { t } from '@/strings';
import { DueList } from '@/ui';
import { nextCharge, pickTotals, sortSubscriptions, totalsByCurrency } from '../logic';
import { subscriptionRepo } from '../repo';

export default function NextChargesWidget() {
  const subs = useLiveQuery(
    async () => (await subscriptionRepo.active().toArray()).filter((s) => s.active),
    [],
  );
  const day = today();
  const rows = sortSubscriptions(subs ?? [], day).map((s) => ({
    s,
    charge: nextCharge(s, day),
  }));
  const first = rows.find((r) => r.charge)?.charge;
  return (
    <DueList
      loading={!subs}
      empty={t.subscriptions.widgetEmpty}
      emptyAction={{ label: t.homeEmpty.subscriptions, to: '/subscriptions?new=1' }}
      summary={
        subs && subs.length > 0
          ? t.widgets.subsSummary(
              formatTotals(pickTotals(totalsByCurrency(subs), 'monthly')),
              first ? formatDay(first, 'd. MMM') : undefined,
            )
          : undefined
      }
      entries={rows.map(({ s, charge }) => {
        const state = charge ? dueState(charge, day) : undefined;
        return {
          key: s.id,
          title: s.name,
          amount: formatMoney(s.amountMinor, currencyOf(s)),
          tone: state?.tone ?? 'none',
          label: state?.label ?? '–',
        };
      })}
      moreLabel={t.widgets.more}
    />
  );
}
