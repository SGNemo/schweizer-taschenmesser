import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { formatDay } from '@/core/time/dates';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { nextOccurrenceAt, sortReminders } from '../logic';
import { reminderRepo } from '../repo';
import styles from './widget.module.css';

export default function NextRemindersWidget() {
  const next = useLiveQuery(async () => {
    const list = sortReminders(await reminderRepo.active().toArray(), now());
    return list
      .filter((r) => r.active)
      .flatMap((r) => {
        const o = nextOccurrenceAt(r, now());
        return o ? [{ id: r.id, title: r.title, ...o }] : [];
      })
      .slice(0, 3);
  }, []);

  if (!next) return <p role="status">…</p>;
  if (next.length === 0) return <p className={styles.muted}>{t.reminders.widgetEmpty}</p>;
  return (
    <div>
      <ul className={styles.list}>
        {next.map((o) => (
          <li key={o.id} className={styles.item}>
            <span className={styles.title}>{o.title}</span>
            <span className={styles.meta}>
              {formatDay(o.date, 'EEE, d. MMM')} · {o.time}
            </span>
          </li>
        ))}
      </ul>
      <Link to="/reminders">{t.reminders.title}</Link>
    </div>
  );
}
