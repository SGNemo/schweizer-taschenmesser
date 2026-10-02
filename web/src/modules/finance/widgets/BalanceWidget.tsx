import { formatMoney } from '@/core/money';
import { endOfMonthStr, monthOf, today } from '@/core/time/dates';
import { t } from '@/strings';
import { KpiWidget } from '@/ui';
import { balances, monthlyTrend } from '../logic';
import { totalBalance, useAvailability, useFinanceData } from '../summary';
import { sumMinor } from '@/core/money';

export default function BalanceWidget() {
  const data = useFinanceData();
  const balance = totalBalance(data);
  const a = useAvailability(balance);
  const loading = !data || balance === undefined || !a;
  const noAccounts = Boolean(data && data.accounts.length === 0);

  const day = today();
  const trend = data ? monthlyTrend(data.txs, monthOf(day), 6) : [];
  const net = trend.at(-1)?.net ?? 0;
  const series = data
    ? trend.map((p) => {
        const asOf = p.month === monthOf(day) ? day : endOfMonthStr(`${p.month}-01`);
        return sumMinor(balances(data.accounts, data.txs, asOf).values());
      })
    : [];
  return (
    <KpiWidget
      loading={loading && !noAccounts}
      value={noAccounts || balance === undefined ? undefined : formatMoney(balance)}
      label={t.finance.balance}
      empty={t.finance.noAccounts}
      emptyAction={{ label: t.finance.title, to: '/finance?tab=accounts' }}
      context={a?.deducting ? t.widgets.kpiAvailable(formatMoney(a.available)) : undefined}
      trend={
        net !== 0
          ? {
              direction: net > 0 ? 'up' : 'down',
              text: t.widgets.kpiMonthNet(`${net > 0 ? '+' : ''}${formatMoney(net)}`),
            }
          : undefined
      }
      series={series}
      seriesLabel={t.widgets.kpiSeries}
    />
  );
}
