import type { Stored } from '@/core/db/types';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { openTotalText } from '../logic';
import type { Invoice } from '../schema';
import styles from '../routes/invoices.module.css';

/**
 * The module's signature in the head: a receipt with a jagged lower edge. Open sum, count and the
 * next due date as text; the shape is decoration only (`aria-hidden` mask), nothing here moves.
 * Without open invoices it stays as the grey empty motif.
 */
export function ReceiptCard({ invoices }: { invoices: Stored<Invoice>[] }) {
  const open = invoices
    .filter((i) => i.status === 'open')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const next = open[0];
  const e = t.invoices.ext.head;
  return (
    <div
      className={`${styles.receipt} ${open.length === 0 ? styles.receiptEmpty : ''}`}
      data-testid="receipt-card"
    >
      <span className={styles.receiptLabel}>{t.invoices.openTotal}</span>
      <b className={styles.receiptSum}>{open.length ? openTotalText(open) : e.nothing}</b>
      {open.length ? (
        <>
          <span className={styles.receiptLine}>{e.count(open.length)}</span>
          {next ? (
            <span className={styles.receiptLine}>
              {e.next(next.payee, formatDay(next.dueDate, 'P'))}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
