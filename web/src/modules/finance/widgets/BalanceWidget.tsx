import { currencyOf, DEFAULT_CURRENCY, formatMoney, sumMinor } from '@/core/money';
import { endOfMonthStr, monthOf, today } from '@/core/time/dates';
import { t } from '@/strings';
import { useNavigate } from 'react-router';
import { Button, KpiWidget, useWidgetSize } from '@/ui';
import { compareMonths } from '../analysis';
import { BankCard } from '@/ui/identity';
import { balances, currenciesOf, filterByCurrency, monthlyTrend, sortAccounts } from '../logic';
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
  const size = useWidgetSize();
  const navigate = useNavigate();
  const cmp = data ? compareMonths(data.txs, monthOf(day)) : undefined;
  const hasPrevious = Boolean(data?.txs.some((x) => x.date.slice(0, 7) < monthOf(day)));
  const expenseChange =
    cmp && hasPrevious && cmp.expense.diffMinor !== 0
      ? t.finance.ext.widget.vsPrevious(
          `${t.finance.expense} ${cmp.expense.diffMinor > 0 ? '▲ +' : '▼ −'}${formatMoney(Math.abs(cmp.expense.diffMinor), currency)}`,
        )
      : '';
  const first = data
    ? sortAccounts(data.accounts).find((a) => currencyOf(a) === currency)
    : undefined;
  const firstBalance =
    first && data ? (balances(data.accounts, data.txs, day).get(first.id) ?? 0) : 0;
  return (
    <>
      {/* The module's signature in small (identity v2): the first account as a card; the figure below is the total. */}
      {size !== 's' && data && first && data.accounts.length > 1 ? (
        <BankCard compact name={first.name} balance={formatMoney(firstBalance, currency)} />
      ) : null}
      {/* The kennzahl shape (identity v3.1, KpiWidget = WidgetBody + KennzahlBody): figure, context line, trend, sparkline at l. */}
      <KpiWidget
        loading={loading && !noAccounts}
        value={noAccounts || balance === undefined ? undefined : formatMoney(balance, currency)}
        empty={t.finance.noAccounts}
        emptyAction={{ label: t.finance.title, to: '/finance?tab=accounts' }}
        context={
          [
            a?.deducting ? t.widgets.kpiAvailable(formatMoney(a.available, currency)) : '',
            others,
            expenseChange,
          ]
            .filter(Boolean)
            .join(' · ') || t.finance.headline.accounts(data?.accounts.length ?? 0)
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
      {/* The one thing done most often: an expense, one click away (opens the booking dialog). */}
      {size !== 's' && !noAccounts ? (
        <Button
          size="sm"
          onClick={() => void navigate('/finance?tab=transactions&new=1')}
          data-testid="widget-add-expense"
        >
          {t.finance.ext.widget.addExpense}
        </Button>
      ) : null}
    </>
  );
}
