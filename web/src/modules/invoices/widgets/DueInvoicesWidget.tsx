import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { formatMoney } from '@/core/money';
import { relativeDayLabel, today } from '@/core/time/dates';
import { dueTone } from '@/core/time/due';
import { t } from '@/strings';
import { openTotal, sortInvoices } from '../logic';
import { invoiceRepo } from '../repo';
import styles from './widget.module.css';

export default function DueInvoicesWidget() {
  const open = useLiveQuery(
    async () =>
      sortInvoices(await invoiceRepo.active().toArray()).filter((i) => i.status === 'open'),
    [],
  );
  if (!open) return <p role="status">…</p>;
  if (open.length === 0) return <p className={styles.muted}>{t.invoices.widgetEmpty}</p>;
  const day = today();
  return (
    <div>
      <p className={styles.total}>{formatMoney(openTotal(open))}</p>
      <p className={styles.muted}>{t.invoices.openCount(open.length)}</p>
      <ul className={styles.list}>
        {open.slice(0, 4).map((i) => (
          <li key={i.id} className={styles.item}>
            <span className={styles.title}>{i.payee}</span>
            <span
              className={
                dueTone(i.dueDate, false, day) === 'overdue' ? styles.overdue : styles.meta
              }
            >
              {relativeDayLabel(i.dueDate, day)}
            </span>
          </li>
        ))}
      </ul>
      <Link to="/invoices">{t.invoices.title}</Link>
    </div>
  );
}
