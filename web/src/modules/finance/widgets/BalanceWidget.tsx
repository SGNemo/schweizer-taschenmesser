import { DEFAULT_CURRENCY, formatMoney, sumMinor } from '@/core/money';
import { endOfMonthStr, monthOf, today } from '@/core/time/dates';
import { t } from '@/strings';
import { KpiWidget } from '@/ui';
import { balances, currenciesOf, filterByCurrency, monthlyTrend } from '../logic';
import { totalBalance, useAvailability, useFinanceData } from '../summary';

export default function BalanceWidget() {
  const all = useFinanceData();
  // The widget shows the first currency (the euro if there is a euro account); the others are named below.
  const currencies = all ? currenciesOf(all.accounts) : [DEFAULT_CURRENCY];
  const currency = currencies[0] ?? DEFAULT_CURRENCY;
  const data = all && currencies.length > 1 ? filterByCurrency(all, currency) : all;
  const others = all
    ? currencies
        .slice(1)
        .map((c) => formatMoney(totalBalance(filterByCurrency(all, c)) ?? 0, c))
        .join(' · ')
    : '';
  const balance = totalBalance(data);
  const a = useAvailability(balance, currency);
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
      value={noAccounts || balance === undefined ? undefined : formatMoney(balance, currency)}
      empty={t.finance.noAccounts}
      emptyAction={{ label: t.finance.title, to: '/finance?tab=accounts' }}
      context={
        [a?.deducting ? t.widgets.kpiAvailable(formatMoney(a.available, currency)) : '', others]
          .filter(Boolean)
          .join(' · ') || undefined
      }
      trend={
        net !== 0
          ? {
              direction: net > 0 ? 'up' : 'down',
              text: t.widgets.kpiMonthNet(`${net > 0 ? '+' : ''}${formatMoney(net, currency)}`),
            }
          : undefined
      }
      series={series}
      seriesLabel={t.widgets.kpiSeries}
    />
  );
}
