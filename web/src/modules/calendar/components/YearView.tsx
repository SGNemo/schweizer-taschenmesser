import type { CalendarItem } from '@/core/modules/types';
import { formatDay, today } from '@/core/time/dates';
import { weekdayShort } from '@/core/recurrence/describe';
import { useWeekStart } from '@/core/settings/core';
import { t } from '@/strings';
import type { HolidayId } from '../holidays';
import { groupByDate, monthWeeks, weekNumberOf } from '../views';
import styles from '../routes/calendar.module.css';

interface Props {
  /** Any date of the year to show. */
  date: string;
  items: CalendarItem[];
  holidays: Map<string, HolidayId>;
  onPickDay: (date: string) => void;
}

/**
 * Twelve small months. A day with entries gets a dot under the number and says how many in its
 * label; holidays are underlined and named in the label, so nothing depends on colour.
 */
export function YearView({ date, items, holidays, onPickDay }: Props) {
  const weekStart = useWeekStart();
  const byDate = groupByDate(items);
  const now = today();
  const year = date.slice(0, 4);
  const order = weekStart === 7 ? [7, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7];
  return (
    <div className={styles.year}>
      {Array.from({ length: 12 }, (_, m) => {
        const first = `${year}-${String(m + 1).padStart(2, '0')}-01`;
        return (
          <section key={first} className={styles.miniMonth} aria-label={formatDay(first, 'LLLL')}>
            <h3 className={styles.miniTitle}>
              <button type="button" className={styles.linkBtn} onClick={() => onPickDay(first)}>
                {formatDay(first, 'LLLL')}
              </button>
            </h3>
            <table className={styles.miniTable}>
              <thead>
                <tr>
                  <th scope="col" className={styles.weekNo}>
                    {t.calendar.weekNoShort}
                  </th>
                  {order.map((wd) => (
                    <th key={wd} scope="col">
                      {weekdayShort(wd).slice(0, 2)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthWeeks(first, weekStart).map((week) => (
                  <tr key={week[0]}>
                    <th scope="row" className={styles.weekNo}>
                      {weekNumberOf(week[0]!, weekStart)}
                    </th>
                    {week.map((d) => {
                      if (d.slice(0, 7) !== first.slice(0, 7)) return <td key={d} />;
                      const n = byDate.get(d)?.length ?? 0;
                      const holiday = holidays.get(d);
                      return (
                        <td key={d}>
                          <button
                            type="button"
                            className={`${styles.miniDay} ${d === now ? styles.miniToday : ''} ${holiday ? styles.miniHoliday : ''}`}
                            aria-label={
                              t.calendar.dayLabel(formatDay(d, 'EEEE, d. MMMM'), n) +
                              (holiday ? `, ${t.calendar.holidays[holiday]}` : '')
                            }
                            onClick={() => onPickDay(d)}
                          >
                            {Number(d.slice(8, 10))}
                            {n > 0 ? <span className={styles.miniDot} aria-hidden="true" /> : null}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
