import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { formatMoney } from '@/core/money';
import { formatDay, today } from '@/core/time/dates';
import { t } from '@/strings';
import { Card, Icon, Segmented, SensitiveValue } from '@/ui';
import { Bars, Donut } from '@/ui/charts';
import { invoiceOverview } from '../overview';
import type { Invoice } from '../schema';
import styles from './InvoicesOverview.module.css';

type Shown = 'open' | 'paid';

/** Month under its column: the short name, with the year on the first column and on every January. */
const monthLabel = (month: string, first: boolean) =>
  formatDay(`${month}-01`, first || month.endsWith('-01') ? 'MMM yy' : 'MMM');

/**
 * The tab „Überblick“: three figures (open, past their date, paid this month), where the money goes per payee
 * (open or paid in the last twelve months) and what was paid per month. Read-only: paying stays in the lists.
 */
export function InvoicesOverview({
  invoices,
  onShowLate,
}: {
  invoices: Stored<Invoice>[];
  /** Opens the list with the invoices past their date (the late figure's count is the link). */
  onShowLate?: () => void;
}) {
  const o = t.invoices.ext.overview;
  const day = today();
  const ov = invoiceOverview(invoices, day);
  const [shown, setShown] = useState<Shown>('open');
  const money = (minor: number) => formatMoney(minor, ov.currency);
  const payees = shown === 'open' ? ov.openByPayee : ov.paidByPayee;
  const anyPaid = ov.months.some((m) => m.minor > 0);

  return (
    <div className={styles.overview} data-testid="invoices-overview">
      <ul className={styles.figures} aria-label={o.figures}>
        <li
          className={styles.figure}
          data-tone={ov.late.count > 0 ? 'late' : undefined}
          data-testid="invoices-figure-late"
        >
          <span className={styles.label}>
            {ov.late.count > 0 ? (
              <span className={styles.lateIcon}>
                <Icon name="alert" size={16} />
              </span>
            ) : null}
            {o.late}
          </span>
          {ov.late.count > 0 ? (
            <>
              <span className={styles.value}>
                <SensitiveValue compact>{money(ov.late.minor)}</SensitiveValue>
              </span>
              {onShowLate ? (
                <button
                  type="button"
                  className={styles.show}
                  onClick={onShowLate}
                  aria-label={o.lateShow(ov.late.count)}
                  data-testid="invoices-figure-late-show"
                >
                  {o.count(ov.late.count)}
                </button>
              ) : (
                <span className={styles.context}>{o.count(ov.late.count)}</span>
              )}
            </>
          ) : (
            <span className={styles.calm}>{o.lateNone}</span>
          )}
        </li>
        <li className={styles.figure} data-testid="invoices-figure-paid">
          <span className={styles.label}>{o.paidMonth(formatDay(day, 'LLLL'))}</span>
          <span className={styles.value}>
            <SensitiveValue compact>{money(ov.paidMonth.minor)}</SensitiveValue>
          </span>
          <span className={styles.context}>{o.count(ov.paidMonth.count)}</span>
        </li>
      </ul>

      <div className={styles.charts}>
        <Card title={o.byPayee} className={styles.card}>
          <Segmented<Shown>
            label={o.show}
            value={shown}
            options={[
              { value: 'open', label: o.showOpen },
              { value: 'paid', label: o.showPaid },
            ]}
            onChange={setShown}
          />
          <Donut
            title={shown === 'open' ? o.byPayeeOpen : o.byPayeePaid}
            data={payees}
            format={money}
            centreLabel={shown === 'open' ? o.centreOpen : o.centrePaid}
            emptyText={shown === 'open' ? o.emptyOpen : o.emptyPaid}
            sensitive
            data-testid="invoices-donut"
          />
        </Card>

        <Card title={o.months} className={styles.card}>
          <Bars
            title={o.months}
            orientation="vertical"
            data={
              anyPaid
                ? ov.months.map((m, n) => ({
                    id: m.month,
                    label: monthLabel(m.month, n === 0),
                    value: m.minor,
                  }))
                : []
            }
            format={money}
            emptyText={o.emptyPaid}
            sensitive
            data-testid="invoices-months"
          />
        </Card>
      </div>

      {ov.skipped > 0 ? (
        <p className={styles.note} data-testid="invoices-overview-skipped">
          {o.skipped(ov.skipped, ov.currency)}
        </p>
      ) : null}
    </div>
  );
}
