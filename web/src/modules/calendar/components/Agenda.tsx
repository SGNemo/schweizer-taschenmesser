import { useCalendarItems } from '@/core/modules/contributions';
import type { CalendarItem } from '@/core/modules/types';
import { addDaysStr, formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { usePersonFilter } from '@/core/people/PersonFilter';
import { personName, usePeople } from '@/core/people/people';
import { CalendarLeaf } from '@/ui/identity';
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
  const people = usePeople();
  const forPerson = usePersonFilter();
  const byDate = groupByDate((items ?? []).filter((i) => !forPerson || i.personId === forPerson));
  const days = Array.from({ length: DAYS }, (_, i) => addDaysStr(date, i)).filter(
    (d, i) => i === 0 || byDate.has(d),
  );
  return (
    <section className={styles.agenda}>
      <div className={styles.agendaTitle}>
        <span aria-hidden="true">
          <CalendarLeaf month={formatDay(date, 'MMM')} day={formatDay(date, 'd')} size="sm" />
        </span>
        <h2>{t.calendar.agenda}</h2>
      </div>
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
                  <ItemRow
                    key={`${i.source}:${i.id}`}
                    item={i}
                    onOpen={onOpenItem}
                    compact
                    person={personName(people, i.personId)}
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
