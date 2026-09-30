import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { formatMoney } from '@/core/money';
import { formatDay, today } from '@/core/time/dates';
import { t } from '@/strings';
import { nextCharge, sortSubscriptions, totals } from '../logic';
import { subscriptionRepo } from '../repo';
import styles from './widget.module.css';

export default function NextChargesWidget() {
  const subs = useLiveQuery(
    async () => (await subscriptionRepo.active().toArray()).filter((s) => s.active),
    [],
  );
  if (!subs) return <p role="status">…</p>;
  if (subs.length === 0) return <p className={styles.muted}>{t.subscriptions.widgetEmpty}</p>;
  const day = today();
  const next = sortSubscriptions(subs, day).slice(0, 4);
  return (
    <div>
      <p className={styles.total}>
        {formatMoney(totals(subs).monthly)}{' '}
        <span className={styles.muted}>{t.subscriptions.perMonthShort}</span>
      </p>
      <ul className={styles.list}>
        {next.map((s) => {
          const charge = nextCharge(s, day);
          return (
            <li key={s.id} className={styles.item}>
              <span className={styles.title}>{s.name}</span>
              <span className={styles.meta}>
                {charge ? formatDay(charge, 'd. MMM') : '–'} · {formatMoney(s.amountMinor)}
              </span>
            </li>
          );
        })}
      </ul>
      <Link to="/subscriptions">{t.subscriptions.title}</Link>
    </div>
  );
}
