import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router';
import { useModuleStates } from '@/core/modules/activation';
import { currenciesOf, filterByCurrency } from '../logic';
import { DEFAULT_CURRENCY, formatMoney } from '@/core/money';
import { addDaysStr, endOfMonthStr, today } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, KpiWidget, SensitiveValue, useWidgetSize } from '@/ui';
// Sanctioned cross-module read access (see CLAUDE.md): only the public.ts of these two modules.
import { listOpenInvoices } from '@/modules/invoices/public';
import { listSubscriptionCharges } from '@/modules/subscriptions/public';
import { monthGlance } from '../month';
import { totalBalance, useFinanceData } from '../summary';

/** "Diesen Monat": free until the month ends, with what is still coming and what was spent. */
export default function MonthWidget() {
  const all = useFinanceData();
  const states = useModuleStates();
  const currency = (all ? currenciesOf(all.accounts)[0] : undefined) ?? DEFAULT_CURRENCY;
  const data = all ? filterByCurrency(all, currency) : undefined;
  const day = today();
  const subsOn = Boolean(states?.subscriptions);
  const invoicesOn = Boolean(states?.invoices);
  const extra = useLiveQuery(async () => {
    const [charges, invoices] = await Promise.all([
      subsOn ? listSubscriptionCharges(addDaysStr(day, 1), endOfMonthStr(day), currency) : [],
      invoicesOn ? listOpenInvoices() : [],
    ]);
    return { charges, invoices: invoices.filter((i) => i.currency === currency) };
  }, [subsOn, invoicesOn, day, currency]);
  const size = useWidgetSize();
  const navigate = useNavigate();
  const m = t.finance.ext.month;
  const balance = totalBalance(data);
  const noAccounts = Boolean(data && data.accounts.length === 0);
  const g =
    data && extra && balance !== undefined
      ? monthGlance({ balanceMinor: balance, today: day, txs: data.txs, ...extra })
      : undefined;
  const body = (
    <KpiWidget
      loading={!g && !noAccounts}
      label={m.free}
      value={noAccounts || !g ? undefined : formatMoney(g.freeMinor, currency)}
      empty={t.finance.noAccounts}
      emptyAction={{ label: t.finance.title, to: '/finance?tab=accounts' }}
      context={
        g
          ? [
              g.comingCount > 0 ? m.coming(formatMoney(g.comingMinor, currency)) : m.nothingComing,
              m.spent(formatMoney(g.spentMinor, currency)),
            ].join(' · ')
          : ''
      }
    />
  );
  return (
    <>
      {g ? <SensitiveValue note={m.title}>{body}</SensitiveValue> : body}
      {size !== 's' && g && g.comingCount > 0 ? (
        <Button size="sm" variant="ghost" onClick={() => void navigate('/finance?tab=overview')}>
          {m.open}
        </Button>
      ) : null}
    </>
  );
}
