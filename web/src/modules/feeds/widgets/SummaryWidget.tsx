import { formatNumber } from '@/core/i18n/format';
import { t } from '@/strings';
import { KpiWidget } from '@/ui';
import { useSummary } from './useSummary';

/** Home-screen widget: how many feeds are subscribed, with the number of groups as context. */
export default function SummaryWidget() {
  const summary = useSummary();
  const s = t.feeds.widget;
  return (
    <KpiWidget
      loading={!summary}
      value={summary && summary.count > 0 ? formatNumber(summary.count) : undefined}
      label={s.label}
      context={summary ? s.context(summary.count, summary.groups) : undefined}
      empty={s.empty}
      emptyAction={{ label: s.add, to: '/feeds?new=1' }}
    />
  );
}
