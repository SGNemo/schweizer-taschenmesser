import { useCalendarItems } from '@/core/modules/contributions';
import type { CalendarItem } from '@/core/modules/types';
import { addDaysStr, formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { groupByDate } from '../views';
import { ItemRow } from './ItemRow';
import styles from '../routes/calendar.module.css';

const DAYS = 7;

/** Side panel on wide screens: the shown day and the following week, grouped by day. */
export function Agenda({
  date,
  onOpenItem,
}: {
  date: string;
  onOpenItem: (item: CalendarItem) => void;
}) {
  const items = useCalendarItems({ from: date, to: addDaysStr(date, DAYS - 1) });
  const byDate = groupByDate(items ?? []);
  const days = Array.from({ length: DAYS }, (_, i) => addDaysStr(date, i)).filter(
    (d, i) => i === 0 || byDate.has(d),
  );
  return (
    <section className={styles.agenda}>
      <h2 className={styles.agendaTitle}>{t.calendar.agenda}</h2>
      {days.map((d) => {
        const list = byDate.get(d) ?? [];
        return (
          <div key={d} className={styles.agendaDay}>
            <h3 className={styles.agendaHead}>{formatDay(d, 'EEEE, d. MMMM')}</h3>
            {list.length === 0 ? (
              <p className={styles.muted}>{t.calendar.nothing}</p>
            ) : (
              <ul className={styles.itemList}>
                {list.map((i) => (
                  <ItemRow key={`${i.source}:${i.id}`} item={i} onOpen={onOpenItem} compact />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
