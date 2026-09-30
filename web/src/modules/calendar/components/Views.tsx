import type { CalendarItem } from '@/core/modules/types';
import { formatDay, today } from '@/core/time/dates';
import { weekdayShort } from '@/core/recurrence/describe';
import { useWeekStart } from '@/core/settings/core';
import { t } from '@/strings';
import { Button, useMediaQuery } from '@/ui';
import { groupByDate, monthWeeks } from '../views';
import { ItemRow, kindLabel } from './ItemRow';
import { TimeGrid } from './TimeGrid';
import styles from '../routes/calendar.module.css';

interface ViewProps {
  date: string;
  items: CalendarItem[];
  onPickDay: (date: string) => void;
  onOpenItem: (item: CalendarItem) => void;
}

/** From this width week and day switch from plain lists to the hour grid. */
const TIME_GRID_QUERY = '(min-width: 1400px)';

/** Chips per month cell: taller windows have taller cells and room for more entries. */
function useChipLimit(): number {
  const h800 = useMediaQuery('(min-height: 800px)');
  const h1000 = useMediaQuery('(min-height: 1000px)');
  const h1300 = useMediaQuery('(min-height: 1300px)');
  return h1300 ? 7 : h1000 ? 5 : h800 ? 4 : 3;
}

export function MonthView({ date, items, onPickDay, onOpenItem }: ViewProps) {
  const byDate = groupByDate(items);
  const now = today();
  const MAX_CHIPS = useChipLimit();
  const weekStart = useWeekStart();
  return (
    <div className={styles.monthWrap}>
      <table className={styles.month}>
        <thead>
          <tr>
            {(weekStart === 7 ? [7, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7]).map((wd) => (
              <th key={wd} scope="col">
                {weekdayShort(wd)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthWeeks(date, weekStart).map((week) => (
            <tr key={week[0]}>
              {week.map((d) => {
                const list = byDate.get(d) ?? [];
                const inMonth = d.slice(0, 7) === date.slice(0, 7);
                return (
                  <td
                    key={d}
                    className={`${styles.cell} ${inMonth ? '' : styles.outside} ${d === now ? styles.todayCell : ''}`}
                  >
                    <button
                      type="button"
                      className={styles.dayNum}
                      aria-label={`${formatDay(d, 'EEEE, d. MMMM')}${list.length ? `, ${list.length} Einträge` : ''}`}
                      onClick={() => onPickDay(d)}
                    >
                      {Number(d.slice(8, 10))}
                    </button>
                    <ul className={styles.chips}>
                      {list.slice(0, MAX_CHIPS).map((i) => (
                        <li key={`${i.source}:${i.id}`}>
                          <button
                            type="button"
                            className={`${styles.chip} ${styles[`kind_${i.kind}`] ?? ''} ${i.done ? styles.done : ''}`}
                            title={`${kindLabel(i.kind)}: ${i.title}`}
                            onClick={() => onOpenItem(i)}
                          >
                            {i.time ? `${i.time} ` : ''}
                            {i.title}
                          </button>
                        </li>
                      ))}
                      {list.length > MAX_CHIPS ? (
                        <li>
                          <button
                            type="button"
                            className={styles.more}
                            onClick={() => onPickDay(d)}
                          >
                            {t.calendar.more(list.length - MAX_CHIPS)}
                          </button>
                        </li>
                      ) : null}
                    </ul>
                    {list.length > 0 ? (
                      <span className={styles.dots} aria-hidden="true">
                        {list.slice(0, 3).map((i) => (
                          <span
                            key={`${i.source}:${i.id}`}
                            className={`${styles.dot} ${styles[`kind_${i.kind}`] ?? ''}`}
                          />
                        ))}
                      </span>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WeekView({
  days,
  items,
  onPickDay,
  onOpenItem,
}: Omit<ViewProps, 'date'> & { days: string[] }) {
  const byDate = groupByDate(items);
  const now = today();
  const grid = useMediaQuery(TIME_GRID_QUERY);
  if (grid)
    return <TimeGrid days={days} items={items} onPickDay={onPickDay} onOpenItem={onOpenItem} />;
  return (
    <div className={styles.week}>
      {days.map((d) => {
        const list = byDate.get(d) ?? [];
        return (
          <section
            key={d}
            className={`${styles.weekDay} ${d === now ? styles.todayCell : ''}`}
            aria-label={formatDay(d, 'EEEE, d. MMMM')}
          >
            <h3 className={styles.weekHead}>
              <button type="button" className={styles.linkBtn} onClick={() => onPickDay(d)}>
                {formatDay(d, 'EEEE, d. MMMM')}
              </button>
            </h3>
            {list.length === 0 ? (
              <p className={styles.muted}>{t.calendar.nothing}</p>
            ) : (
              <ul className={styles.itemList}>
                {list.map((i) => (
                  <ItemRow key={`${i.source}:${i.id}`} item={i} onOpen={onOpenItem} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function DayView({
  date,
  items,
  onOpenItem,
  onAdd,
}: Omit<ViewProps, 'onPickDay'> & { onAdd: (date: string) => void }) {
  const grid = useMediaQuery(TIME_GRID_QUERY);
  if (grid)
    return (
      <TimeGrid days={[date]} items={items} onPickDay={() => undefined} onOpenItem={onOpenItem} />
    );
  return (
    <div>
      {items.length === 0 ? <p className={styles.muted}>{t.calendar.nothing}</p> : null}
      <ul className={styles.itemList}>
        {items.map((i) => (
          <ItemRow key={`${i.source}:${i.id}`} item={i} onOpen={onOpenItem} />
        ))}
      </ul>
      <div style={{ marginTop: 'var(--space-4)' }}>
        <Button onClick={() => onAdd(date)}>{t.calendar.newEvent}</Button>
      </div>
    </div>
  );
}
