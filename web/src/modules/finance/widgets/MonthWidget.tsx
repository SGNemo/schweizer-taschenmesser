import { useNavigate } from 'react-router';
import { DEFAULT_CURRENCY, formatMoney } from '@/core/money';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, KpiWidget, SensitiveValue, useWidgetSize } from '@/ui';
import { currenciesOf, filterByCurrency } from '../logic';
import { monthGlance } from '../month';
import { useFinanceData, useForecast } from '../summary';

/** "Diesen Monat": free at the month's end (the outlook), what is still coming and what was spent. */
export default function MonthWidget() {
  const all = useFinanceData();
  const currency = (all ? currenciesOf(all.accounts)[0] : undefined) ?? DEFAULT_CURRENCY;
  const data = all ? filterByCurrency(all, currency) : undefined;
  const forecast = useForecast(data, currency, 'month');
  const navigate = useNavigate();
  const size = useWidgetSize();
  const m = t.finance.ext.month;
  const day = today();
  const noAccounts = Boolean(data && data.accounts.length === 0);
  const g = data && forecast ? monthGlance({ forecast, today: day, txs: data.txs }) : undefined;
  const body = (
    <KpiWidget
      loading={!g && !noAccounts}
      label={m.free}
      value={noAccounts || !g ? undefined : formatMoney(g.freeMinor, currency)}
      empty={t.finance.noAccounts}
      emptyAction={{ label: t.finance.title, to: '/finance?tab=accounts' }}
      context={
        !g
          ? ''
          : [
              g.comingCount > 0 ? m.coming(formatMoney(g.comingMinor, currency)) : m.nothingComing,
              m.spent(formatMoney(g.spentMinor, currency)),
            ].join(' · ')
      }
    />
  );
  return (
    <>
      {g ? <SensitiveValue note={m.title}>{body}</SensitiveValue> : body}
      {/* Like the balance card: the extra button only from size m; the head opens the module. */}
      {size !== 's' && g && g.comingCount > 0 ? (
        <Button size="sm" variant="ghost" onClick={() => void navigate('/finance?tab=overview')}>
          {m.open}
        </Button>
      ) : null}
    </>
  );
}
