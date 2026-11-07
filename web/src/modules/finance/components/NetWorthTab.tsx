import { today } from '@/core/time/now';
import { t } from '@/strings';
import { EmptyState } from '@/ui';
import { netWorthSeries } from '../netWorth';
import type { FinanceData } from '../types';
import { TrendChart } from './TrendChart';

/** "Verlauf": total balance at each month end of the last 12 months, derived from the bookings. */
export function NetWorthTab({ data }: { data: FinanceData }) {
  const points = netWorthSeries(data.accounts, data.txs, today(), 12);
  if (points.length < 2)
    return (
      <EmptyState title={t.finance.netWorthEmpty} testId="net-worth-empty">
        {t.finance.netWorthEmptyHint}
      </EmptyState>
    );
  return <TrendChart points={points} title={t.finance.netWorthTitle} testId="net-worth-chart" />;
}
