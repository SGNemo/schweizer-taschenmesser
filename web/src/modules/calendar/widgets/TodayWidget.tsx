import { Link } from 'react-router';
import { useCalendarItems } from '@/core/modules/contributions';
import { addDaysStr, today } from '@/core/time/dates';
import { t } from '@/strings';
import { EmptyState, Skeleton } from '@/ui';
import { ItemRow } from '../components/ItemRow';
import styles from './widget.module.css';

export default function TodayWidget() {
  const day = today();
  const next = addDaysStr(day, 1);
  const items = useCalendarItems({ from: day, to: next });
  if (!items) return <Skeleton width="60%" height="1.25rem" />;
  const open = items.filter((i) => !i.done);
  const groups = [
    { label: t.calendar.today, date: day },
    { label: 'Morgen', date: next },
  ];
  return (
    <div className={styles.wrap}>
      {open.length === 0 ? (
        <EmptyState compact title={t.calendar.widgetEmpty}>
          <Link to="/calendar?new=1">{t.homeEmpty.calendar}</Link>
        </EmptyState>
      ) : null}
      {groups.map((g) => {
        const list = open.filter((i) => i.date === g.date);
        if (list.length === 0) return null;
        return (
          <section key={g.date} aria-label={g.label}>
            <h3 className={styles.h}>{g.label}</h3>
            <ul className={styles.list}>
              {list.map((i) => (
                <ItemRow key={`${i.source}:${i.id}`} item={i} compact />
              ))}
            </ul>
          </section>
        );
      })}
      <Link to={`/calendar?view=day&date=${day}`}>{t.calendar.title}</Link>
    </div>
  );
}
