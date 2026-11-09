import type { CalendarItem } from '@/core/modules/types';
import { formatDay, today } from '@/core/time/dates';
import { weekdayShort } from '@/core/recurrence/describe';
import { useWeekStart } from '@/core/settings/core';
import { t } from '@/strings';
import { Button, EmptyState, patternStyles, useMediaQuery } from '@/ui';
import { usePageWidthAtLeast } from '@/ui/pageWidth';
import { personName, usePeople } from '@/core/people/people';
import type { Slot } from '../dragMath';
import type { HolidayId } from '../holidays';
import { dailyRepeats, groupByDate, monthWeeks, repeatKey, weekNumberOf } from '../views';
import { ItemRow, kindLabel } from './ItemRow';
import { sourceHue } from './sourceHue';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { TimeGrid } from './TimeGrid';
import styles from '../routes/calendar.module.css';

interface ViewProps {
  date: string;
  items: CalendarItem[];
  onPickDay: (date: string) => void;
  onOpenItem: (item: CalendarItem) => void;
  /** Public holidays of the shown range (empty when the setting is off). */
  holidays?: Map<string, HolidayId>;
  /** Hour-grid editing (wide screens): move / stretch an event, draw a new slot. */
  onMoveItem?: (item: CalendarItem, slot: Slot) => void;
  onCreateSlot?: (date: string, startTime: string, endTime: string) => void;
}

/**
 * From this page width week and day switch from plain lists to the hour grid (C19: the page container decides, not the
 * window – with the sidebar open a 1400 px window has about 68 rem of page). The window query is the fallback before
 * the page is measured (jsdom, first paint).
 */
const TIME_GRID_REM = 66;
const TIME_GRID_QUERY = '(min-width: 1400px)';
/**
 * From this page width (and a window of at least 700 px) a month cell names its entries as lines (same threshold as
 * `@container page` in the CSS); below, a cell shows marks and a count, and a title only where it fits in full.
 */
const MONTH_CHIPS_REM = 40;
const MONTH_LINES_QUERY = '(min-width: 700px)';

function useTimeGrid(): boolean {
  const viewport = useMediaQuery(TIME_GRID_QUERY);
  return usePageWidthAtLeast(TIME_GRID_REM) ?? viewport;
}

/**
 * Lines per month cell (S03, UI round 6): three up to a 1080 px window, then "+n weitere"; taller windows have taller
 * cells and room for more – lines are shorter than the former pills, so 1300 px holds six.
 */
function useLineLimit(): number {
  const h1150 = useMediaQuery('(min-height: 1150px)');
  const h1300 = useMediaQuery('(min-height: 1300px)');
  return h1300 ? 6 : h1150 ? 4 : 3;
}

/** The quiet kind mark of an entry (the kind itself is in the tooltip and the day's list). */
function KindMark({ item }: { item: CalendarItem }) {
  return (
    <span
      className={styles.lineMark}
      data-kind={item.kind}
      data-hue={sourceHue(item)}
      style={item.color ? ({ '--cal': item.color } as CSSProperties) : undefined}
      aria-hidden="true"
    />
  );
}

/**
 * A text that is shown only when it fits in full: a phone cell never shows a fragment like "Ver…" (S03). Measured after
 * layout and again when the cell changes size.
 */
function FitText({ className, children }: { className?: string; children: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [fits, setFits] = useState(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setFits(el.scrollWidth <= el.clientWidth + 1);
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);
  return (
    <span ref={ref} className={className} data-fits={fits ? 'true' : 'false'}>
      {children}
    </span>
  );
}

export function MonthView({ date, items, onPickDay, onOpenItem, holidays }: ViewProps) {
  const byDate = groupByDate(items);
  const now = today();
  const limit = useLineLimit();
  const repeats = dailyRepeats(items);
  // A phone cell has room for marks, not for lines: narrow below 700 px or a narrow page, whichever says so.
  const wideViewport = useMediaQuery(MONTH_LINES_QUERY);
  const widePage = usePageWidthAtLeast(MONTH_CHIPS_REM);
  const wide = wideViewport && (widePage ?? true);
  const weekStart = useWeekStart();
  return (
    <div className={styles.monthWrap}>
      <table className={styles.month}>
        <thead>
          <tr>
            <th scope="col" className={styles.weekNo}>
              {t.calendar.weekNoShort}
            </th>
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
              <th scope="row" className={styles.weekNo}>
                {weekNumberOf(week[0]!, weekStart)}
              </th>
              {week.map((d) => {
                const list = byDate.get(d) ?? [];
                const holiday = holidays?.get(d);
                const inMonth = d.slice(0, 7) === date.slice(0, 7);
                return (
                  <td
                    key={d}
                    className={`${styles.cell} ${inMonth ? '' : styles.outside} ${d === now ? styles.todayCell : ''}`}
                  >
                    <button
                      type="button"
                      className={styles.dayNum}
                      aria-label={
                        t.calendar.dayLabel(formatDay(d, 'EEEE, d. MMMM'), list.length) +
                        (holiday ? `, ${t.calendar.holidays[holiday]}` : '')
                      }
                      onClick={() => onPickDay(d)}
                    >
                      {Number(d.slice(8, 10))}
                    </button>
                    {holiday ? (
                      wide ? (
                        <span className={styles.cellHoliday} title={t.calendar.holidayLabel}>
                          {t.calendar.holidays[holiday]}
                        </span>
                      ) : (
                        <FitText className={styles.cellHoliday}>
                          {t.calendar.holidays[holiday]}
                        </FitText>
                      )
                    ) : null}
                    {wide ? (
                      <ul className={styles.lines}>
                        {list.slice(0, limit).map((i) => (
                          <li key={`${i.source}:${i.id}`}>
                            <button
                              type="button"
                              className={`${styles.line} ${i.kind === 'event' ? styles.lineOwn : ''} ${repeats.has(repeatKey(i)) ? styles.lineRepeat : ''} ${i.done ? styles.done : ''}`}
                              title={`${kindLabel(i.kind)}: ${i.title}`}
                              style={i.color ? ({ '--cal': i.color } as CSSProperties) : undefined}
                              onClick={() => onOpenItem(i)}
                            >
                              <KindMark item={i} />
                              {i.time ? <span className={styles.lineTime}>{i.time}</span> : null}
                              <span className={styles.lineTitle}>{i.title}</span>
                            </button>
                          </li>
                        ))}
                        {list.length > limit ? (
                          <li>
                            <button
                              type="button"
                              className={styles.more}
                              onClick={() => onPickDay(d)}
                            >
                              {t.calendar.more(list.length - limit)}
                            </button>
                          </li>
                        ) : null}
                      </ul>
                    ) : list.length > 0 ? (
                      <>
                        <FitText className={styles.cellLabel}>{list[0]!.title}</FitText>
                        <span className={styles.dots} aria-hidden="true">
                          {list.slice(0, 3).map((i) => (
                            <KindMark key={`${i.source}:${i.id}`} item={i} />
                          ))}
                          {list.length > 3 ? (
                            <span className={styles.dotsMore}>{`+${list.length - 3}`}</span>
                          ) : null}
                        </span>
                      </>
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
  holidays,
  onMoveItem,
  onCreateSlot,
}: Omit<ViewProps, 'date'> & { days: string[] }) {
  const byDate = groupByDate(items);
  const now = today();
  const grid = useTimeGrid();
  const people = usePeople();
  if (grid)
    return (
      <TimeGrid
        days={days}
        items={items}
        onPickDay={onPickDay}
        onOpenItem={onOpenItem}
        onMoveItem={onMoveItem}
        onCreateSlot={onCreateSlot}
      />
    );
  return (
    <div className={styles.week}>
      {days.map((d) => {
        const list = byDate.get(d) ?? [];
        // An empty day is one quiet line, so a week with few entries stays short.
        const empty = list.length === 0;
        return (
          <section
            key={d}
            className={`${styles.weekDay} ${empty ? styles.weekDayEmpty : ''} ${d === now ? styles.todayCell : ''}`}
            aria-label={formatDay(d, 'EEEE, d. MMMM')}
          >
            <h3 className={styles.weekHead}>
              <button type="button" className={styles.linkBtn} onClick={() => onPickDay(d)}>
                {formatDay(d, 'EEEE, d. MMMM')}
              </button>
              {holidays?.get(d) ? (
                <span className={styles.holidayTag}>{t.calendar.holidays[holidays.get(d)!]}</span>
              ) : null}
            </h3>
            {empty ? (
              <span className={styles.muted}>{t.calendar.nothing}</span>
            ) : (
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
  onMoveItem,
  onCreateSlot,
}: Omit<ViewProps, 'onPickDay'> & { onAdd: (date: string) => void }) {
  const grid = useTimeGrid();
  const people = usePeople();
  if (grid)
    return (
      <TimeGrid
        days={[date]}
        items={items}
        onPickDay={() => undefined}
        onOpenItem={onOpenItem}
        onMoveItem={onMoveItem}
        onCreateSlot={onCreateSlot}
      />
    );
  return (
    <div>
      {items.length === 0 ? <EmptyState compact title={t.calendar.nothing} /> : null}
      <ul className={styles.itemList}>
        {items.map((i) => (
          <ItemRow
            key={`${i.source}:${i.id}`}
            item={i}
            onOpen={onOpenItem}
            person={personName(people, i.personId)}
          />
        ))}
      </ul>
      <div className={patternStyles.gapTop}>
        <Button onClick={() => onAdd(date)}>{t.calendar.newEvent}</Button>
      </div>
    </div>
  );
}
