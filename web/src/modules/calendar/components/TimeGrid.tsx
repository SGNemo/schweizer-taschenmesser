import { useEffect, useRef, type CSSProperties } from 'react';
import type { CalendarItem } from '@/core/modules/types';
import { formatDay, isoWeekday, nowTime, today } from '@/core/time/dates';
import { t } from '@/strings';
import { groupByDate, splitDay } from '../views';
import { kindLabel } from './ItemRow';
import styles from '../routes/calendar.module.css';

interface Props {
  days: string[];
  items: CalendarItem[];
  onPickDay: (date: string) => void;
  onOpenItem: (item: CalendarItem) => void;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Week / day view with an hour grid that fills the available height. Untimed items sit in a row
 * above the grid; on open the grid scrolls to the current time (or shortly before the first item).
 */
export function TimeGrid({ days, items, onPickDay, onOpenItem }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const byDate = groupByDate(items);
  const now = today();
  const perDay = days.map((d) => ({ d, ...splitDay(byDate.get(d) ?? []) }));
  const hasUntimed = perDay.some((p) => p.untimed.length > 0);

  // Scroll once per shown range: to "now" when today is visible, else to the earliest item.
  const rangeKey = `${days[0]}:${days.length}`;
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const hourPx = body.scrollHeight / 24;
    const visibleToday = days.includes(now);
    const first = Math.min(...perDay.flatMap((p) => p.timed.map((x) => x.start)), 8 * 60);
    const target = visibleToday ? minutes(nowTime()) : first;
    body.scrollTop = Math.max(0, (target / 60 - 1.5) * hourPx);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the shown range changes
  }, [rangeKey]);

  const cols = { '--cols': days.length } as CSSProperties;
  return (
    <div className={styles.tg} role="group" aria-label={t.calendar.timeGrid}>
      <div className={styles.tgInner} style={cols}>
        <div className={styles.tgHead}>
          <span className={styles.tgGutter} />
          {perDay.map(({ d }) => (
            <h3 key={d} className={`${styles.tgDay} ${d === now ? styles.todayCell : ''}`}>
              <button type="button" className={styles.linkBtn} onClick={() => onPickDay(d)}>
                {formatDay(d, days.length > 1 ? 'EEE d.' : 'EEEE, d. MMMM')}
              </button>
            </h3>
          ))}
        </div>
        {hasUntimed ? (
          <div className={styles.tgHead} role="group" aria-label={t.calendar.allDayRow}>
            <span className={styles.tgGutter} />
            {perDay.map(({ d, untimed }) => (
              <ul key={d} className={styles.tgUntimed}>
                {untimed.map((i) => (
                  <li key={`${i.source}:${i.id}`}>
                    <button
                      type="button"
                      className={`${styles.chip} ${styles[`kind_${i.kind}`] ?? ''} ${i.done ? styles.done : ''}`}
                      title={`${kindLabel(i.kind)}: ${i.title}`}
                      onClick={() => onOpenItem(i)}
                    >
                      {i.title}
                    </button>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        ) : null}
        <div className={styles.tgBody} ref={bodyRef}>
          <div className={styles.tgHours} aria-hidden="true">
            {HOURS.map((h) => (
              <span key={h}>{`${String(h).padStart(2, '0')}:00`}</span>
            ))}
          </div>
          {perDay.map(({ d, timed }) => (
            <div
              key={d}
              className={`${styles.tgCol} ${isoWeekday(d) >= 6 ? styles.tgWeekend : ''} ${d === now ? styles.tgToday : ''}`}
            >
              {timed.map(({ item, start, end, lane, lanes }) => (
                <button
                  key={`${item.source}:${item.id}`}
                  type="button"
                  className={`${styles.tgItem} ${styles[`kind_${item.kind}`] ?? ''} ${item.done ? styles.done : ''}`}
                  style={
                    {
                      '--start': start,
                      '--minutes': end - start,
                      '--lane': lane,
                      '--lanes': lanes,
                    } as CSSProperties
                  }
                  title={`${kindLabel(item.kind)}: ${item.title}`}
                  onClick={() => onOpenItem(item)}
                >
                  <span className={styles.tgTime}>{item.time}</span> {item.title}
                </button>
              ))}
              {d === now ? (
                <span
                  className={styles.tgNow}
                  aria-hidden="true"
                  style={{ '--start': minutes(nowTime()) } as CSSProperties}
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
