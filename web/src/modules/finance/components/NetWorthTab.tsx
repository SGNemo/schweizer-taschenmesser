import { formatMoney } from '@/core/money';
import { today } from '@/core/time/now';
import { t } from '@/strings';
import { useNavigate } from 'react-router';
import { Button, EmptyState, ItemList, ItemRow, SensitiveValue } from '@/ui';
import { netWorth, netWorthSeries } from '../netWorth';
import { useCurrency } from '../currency';
import { useOpenUntilMonthEnd } from '../summary';
import type { FinanceData } from '../types';
import styles from '../routes/finance.module.css';
import { TrendChart } from './TrendChart';

/**
 * "Verlauf": the net worth ("Vermögen", the head's figure on this tab) with its context line, split by the kind of
 * account, and its curve over the month ends of the last 12 months. `data` holds the accounts of the shown currency,
 * `all` every account: another currency is one row of its own, never converted and never added.
 */
export function NetWorthTab({ data, all }: { data: FinanceData; all: FinanceData }) {
  const navigate = useNavigate();
  const day = today();
  const points = netWorthSeries(data.accounts, data.txs, day, 12);
  const currency = useCurrency();
  const worth = netWorth(all.accounts, all.txs, day);
  const shown = worth.find((w) => w.currency === currency);
  const others = worth.filter((w) => w !== shown);
  const open = useOpenUntilMonthEnd(currency);
  const n = t.finance.netWorth;
  // One kind is the head's figure again: no row repeats it (B2). Another currency keeps its own row.
  const parts = shown && shown.parts.length > 1 ? shown.parts : [];
  return (
    <>
      {/* The first row of the tab: on the phone the page's "⋯" menu lies beside it (`besideContent`), so the row is
          always there and keeps its height while the counts load. */}
      <div className={styles.worthHead}>
        {shown && (open === undefined || open.invoicesOn || open.subsOn) ? (
          <p className={styles.worthContext} data-testid="net-worth-context">
            {open === undefined
              ? '\u00a0'
              : open.invoices + open.subscriptions > 0
                ? n.open(open.invoices, open.subscriptions)
                : n.nothingOpen(open.invoicesOn, open.subsOn)}
          </p>
        ) : null}
      </div>
      {shown && parts.length + others.length > 0 ? (
        <div className={styles.worthParts} data-testid="net-worth-parts">
          <ItemList label={n.byKind}>
            {parts.map((p) => (
              <ItemRow
                key={p.kind}
                title={t.finance.ext.accountKind[p.kind]}
                // One account of a kind is the row itself; only several are worth a count.
                meta={p.accounts > 1 ? t.finance.headline.accounts(p.accounts) : undefined}
                end={
                  <span className={styles.amount} data-testid={`net-worth-${p.kind}`}>
                    <SensitiveValue>{formatMoney(p.valueMinor, shown.currency)}</SensitiveValue>
                  </span>
                }
              />
            ))}
            {others.map((w) => (
              <ItemRow
                key={w.currency}
                title={n.otherCurrency(w.currency)}
                meta={`${t.finance.headline.accounts(w.accounts)} · ${n.notConverted}`}
                end={
                  <span className={styles.amount} data-testid={`net-worth-${w.currency}`}>
                    <SensitiveValue>{formatMoney(w.totalMinor, w.currency)}</SensitiveValue>
                  </span>
                }
              />
            ))}
          </ItemList>
        </div>
      ) : null}
      {points.length < 2 ? (
        <EmptyState title={t.finance.netWorthEmpty} testId="net-worth-empty">
          {t.finance.netWorthEmptyHint}
          <Button
            variant="primary"
            onClick={() =>
              navigate(data.accounts.length === 0 ? '/finance?tab=accounts' : '/finance?new=1')
            }
          >
            {data.accounts.length === 0 ? t.finance.addAccount : t.finance.addTransaction}
          </Button>
        </EmptyState>
      ) : (
        <TrendChart
          points={points}
          title={t.finance.netWorthTitle}
          testId="net-worth-chart"
          lastElsewhere
        />
      )}
    </>
  );
}
