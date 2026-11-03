import type { CalendarItem } from '@/core/modules/types';
import { formatDay } from '@/core/time/dates';
import { personName, usePeople } from '@/core/people/people';
import { EmptyState } from '@/ui';
import { t } from '@/strings';
import type { HolidayId } from '../holidays';
import { groupByDate } from '../views';
import { ItemRow } from './ItemRow';
import styles from '../routes/calendar.module.css';

interface Props {
  items: CalendarItem[];
  holidays: Map<string, HolidayId>;
  onOpenItem: (item: CalendarItem) => void;
}

/** One list for the next days: only days with entries or a holiday, newest decisions on top. */
export function AgendaView({ items, holidays, onOpenItem }: Props) {
  const people = usePeople();
  const byDate = groupByDate(items);
  const days = [...new Set([...byDate.keys(), ...holidays.keys()])].sort();
  if (days.length === 0) return <EmptyState compact title={t.calendar.agendaEmpty} />;
  return (
    <div className={styles.agendaList}>
      {days.map((d) => {
        const list = byDate.get(d) ?? [];
        const holiday = holidays.get(d);
        return (
          <section key={d} className={styles.agendaDay} aria-label={formatDay(d, 'EEEE, d. MMMM')}>
            <h3 className={styles.agendaHead}>
              {formatDay(d, 'EEEE, d. MMMM')}
              {holiday ? (
                <span className={styles.holidayTag}>{t.calendar.holidays[holiday]}</span>
              ) : null}
            </h3>
            <ul className={styles.itemList}>
              {list.map((i) => (
                <ItemRow
                  key={`${i.source}:${i.id}`}
                  item={i}
                  onOpen={onOpenItem}
                  person={personName(people, i.personId)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
