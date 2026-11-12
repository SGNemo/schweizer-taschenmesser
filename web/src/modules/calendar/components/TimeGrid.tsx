import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import type { CalendarItem } from '@/core/modules/types';
import { formatDay, isoWeekday, nowTime, today } from '@/core/time/dates';
import { t } from '@/strings';
import { movedSlot, resizedEnd, slotFromDrag, snap, SNAP_MINUTES, type Slot } from '../dragMath';
import {
  ALL_DAY_LIMIT,
  dailyRepeats,
  gridScroll,
  groupByDate,
  initialScrollMinute,
  MIN_LANE_REM,
  repeatKey,
  scrollAnchor,
  splitDay,
  stackLanes,
  type GridScrollMemo,
} from '../views';
import { kindLabel } from './ItemRow';
import { KindMark } from './KindMark';
import styles from '../routes/calendar.module.css';

interface Props {
  days: string[];
  items: CalendarItem[];
  onPickDay: (date: string) => void;
  onOpenItem: (item: CalendarItem) => void;
  /** Own, single-day, timed events can be moved (drag or Alt+arrow) and stretched (bottom edge or Alt+Shift+arrow). */
  onMoveItem?: (item: CalendarItem, slot: Slot) => void;
  /** Drawing over an empty part of a day asks for a new event in that slot. */
  onCreateSlot?: (date: string, startTime: string, endTime: string) => void;
}

/** Pixels the pointer has to travel before a press becomes a drag (below it stays a click). */
const DRAG_THRESHOLD = 4;

type Drag =
  | { kind: 'move'; id: string; dMin: number; dDays: number }
  | { kind: 'resize'; id: string; dMin: number }
  | { kind: 'draw'; date: string; a: number; b: number };

const draggable = (item: CalendarItem): boolean =>
  item.source === 'calendar' && !item.external && !!item.time && !item.endDate && !item.continued;

/**
 * Text geometry of a block, in rem; the CSS holds the same values (`--tg-line`, `--tg-row` and the block's padding in
 * `calendar.module.css`). A block shows only whole lines: the count comes from its height (AE4).
 */
const LINE_REM = 1.125;
const STACK_ROW_REM = 1.375;
const STACK_GAP_PX = 2;
/** Height a block loses to its gap (2px) and its vertical padding (2 × 2px). */
const BLOCK_CHROME_PX = 6;
/** Up to this length the time and the title share one line (the hour axis already shows the time). */
const SHORT_MINUTES = 60;

/** Measured grid: width of a day column, height of an hour and the root font size, all in pixels. */
interface Geo {
  col: number;
  hour: number;
  rem: number;
}
const DEFAULT_GEO: Geo = { col: Infinity, hour: 56, rem: 16 };

/** Whole text lines that fit into a block of `mins` minutes. */
const textLines = (mins: number, geo: Geo): number =>
  Math.max(1, Math.floor(((mins / 60) * geo.hour - BLOCK_CHROME_PX) / (LINE_REM * geo.rem)));
/** Whole rows that fit into a stack of `mins` minutes. */
const stackRows = (mins: number, geo: Geo): number =>
  Math.max(
    1,
    Math.floor(
      ((mins / 60) * geo.hour - 2 + STACK_GAP_PX) / (STACK_ROW_REM * geo.rem + STACK_GAP_PX),
    ),
  );

/** Tooltip of a block: kind, time and the full title (the block itself may show less). */
const blockTitle = (item: CalendarItem, overlaps: boolean): string =>
  `${kindLabel(item.kind)}: ${item.time}${item.endTime ? `–${item.endTime}` : ''} ${item.title}${overlaps ? ` – ${t.calendar.overlaps}` : ''}`;

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Week / day view with an hour grid that fills the available height. Untimed items sit in a row
 * above the grid: in the week at most `ALL_DAY_LIMIT` per day plus "+n weitere" (opens the day), in the day view
 * all of them side by side; the pane scrolls on its own, so the grid keeps its hours (S04, UI round 6). On open the
 * grid scrolls to the current time (or shortly before the first item) without cutting a block at its top edge.
 * Block text is clamped to whole lines; overlapping entries share a column only while each lane stays at least
 * `MIN_LANE_REM` wide, the rest folds into a stack of one-line rows with "+n" (opens the day) (AE4).
 */
export function TimeGrid({ days, items, onPickDay, onOpenItem, onMoveItem, onCreateSlot }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // A drag ends in a click event on the same element; this swallows exactly that one.
  const swallowClick = useRef(false);
  const byDate = groupByDate(items);
  const now = today();
  const perDay = days.map((d) => ({ d, ...splitDay(byDate.get(d) ?? []) }));
  const hasUntimed = perDay.some((p) => p.untimed.length > 0);
  // A daily medication reminder stays a quiet line or block, like in the month (S03 look in the week).
  const repeats = dailyRepeats(items);

  // Scroll once per shown range: to "now" when today is visible, else to the earliest item. Once more when the
  // shown days' entries arrive (they load after the first paint, and after Prev/Next the previous range's entries are
  // still in `items` for a moment), so a block at the top edge is never cut; never on the user's own edits (`gridScroll`).
  const hasTimed = perDay.some((p) => p.timed.length > 0);
  const hasAny = hasTimed || hasUntimed;
  const range = `${days[0]}:${days.length}`;
  const scrollMemo = useRef<GridScrollMemo | null>(null);
  const rangeKey = `${range}:${hasAny}:${hasTimed}`;
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const step = gridScroll(scrollMemo.current, range, hasAny, hasTimed);
    scrollMemo.current = step.memo;
    if (!step.scroll) return;
    const hourPx = body.scrollHeight / 24;
    const blocks = perDay.flatMap((p) => p.timed);
    const anchor = scrollAnchor(blocks, minutes(nowTime()), days.includes(now));
    // A little above the hour line: its label is centred on the line and would be cut in half at the top edge.
    body.scrollTop = Math.max(0, (initialScrollMinute(blocks, anchor) / 60) * hourPx - 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the shown range changes
  }, [rangeKey]);

  // The column's width decides how many lanes an overlap may take, the hour's height how many lines a block shows.
  const [geo, setGeo] = useState<Geo>(DEFAULT_GEO);
  useLayoutEffect(() => {
    const col = bodyRef.current?.querySelector<HTMLElement>('[data-date]');
    if (!col) return;
    const measure = () => {
      const rect = col.getBoundingClientRect();
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      if (!rect.width || !rect.height || !rem) return;
      const next = { col: rect.width, hour: rect.height / 24, rem };
      setGeo((g) => (g.col === next.col && g.hour === next.hour && g.rem === next.rem ? g : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(col);
    return () => observer.disconnect();
  }, [days.length]);
  const maxLanes = Math.max(1, Math.floor(geo.col / (MIN_LANE_REM * geo.rem)));

  const cols = { '--cols': days.length } as CSSProperties;
  const single = days.length === 1;

  /** Pixels per minute and the width of one day column, read from the first column. */
  function geometry() {
    const col = bodyRef.current?.querySelector<HTMLElement>('[data-date]');
    if (!col) return null;
    const rect = col.getBoundingClientRect();
    return { perMinute: rect.height / (24 * 60), colWidth: rect.width };
  }
  function minuteAt(colEl: HTMLElement, clientY: number): number {
    const rect = colEl.getBoundingClientRect();
    return Math.min(24 * 60, Math.max(0, ((clientY - rect.top) / rect.height) * 24 * 60));
  }

  function startItemDrag(
    e: PointerEvent<HTMLElement>,
    item: CalendarItem,
    kind: 'move' | 'resize',
  ) {
    if (!onMoveItem || !draggable(item) || e.button !== 0) return;
    const geo = geometry();
    if (!geo) return;
    if (kind === 'resize') e.stopPropagation();
    const x0 = e.clientX;
    const y0 = e.clientY;
    let moved = false;
    let last: Drag = { kind, id: item.id, dMin: 0, dDays: 0 } as Drag;
    const target = e.currentTarget;
    target.setPointerCapture?.(e.pointerId);
    const onMove = (ev: globalThis.PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < DRAG_THRESHOLD) return;
      moved = true;
      const dMin = snap((ev.clientY - y0) / geo.perMinute);
      last =
        kind === 'move'
          ? { kind, id: item.id, dMin, dDays: Math.round((ev.clientX - x0) / geo.colWidth) }
          : { kind, id: item.id, dMin };
      setDrag(last);
    };
    const finish = (ev: globalThis.PointerEvent) => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', finish);
      target.removeEventListener('pointercancel', finish);
      setDrag(null);
      if (!moved || ev.type === 'pointercancel') return;
      swallowClick.current = true;
      commit(item, last);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', finish);
    target.addEventListener('pointercancel', finish);
  }

  function commit(item: CalendarItem, d: Drag) {
    if (!onMoveItem || !item.time) return;
    if (d.kind === 'move') {
      const slot = movedSlot(item.date, item.time, item.endTime, d.dMin, d.dDays);
      if (slot.date !== item.date || slot.startTime !== item.time) onMoveItem(item, slot);
    } else if (d.kind === 'resize') {
      const endTime = resizedEnd(item.time, item.endTime, d.dMin);
      if (endTime !== item.endTime)
        onMoveItem(item, { date: item.date, startTime: item.time, endTime });
    }
  }

  function onItemKey(e: KeyboardEvent<HTMLElement>, item: CalendarItem) {
    if (!onMoveItem || !draggable(item) || !e.altKey) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const dMin = e.key === 'ArrowUp' ? -SNAP_MINUTES : SNAP_MINUTES;
    commit(
      item,
      e.shiftKey
        ? { kind: 'resize', id: item.id, dMin }
        : { kind: 'move', id: item.id, dMin, dDays: 0 },
    );
  }

  function startDraw(e: PointerEvent<HTMLElement>, date: string) {
    // Only on the bare column: a press on an event keeps its own behaviour.
    if (!onCreateSlot || e.button !== 0 || e.target !== e.currentTarget) return;
    const col = e.currentTarget;
    const a = minuteAt(col, e.clientY);
    const y0 = e.clientY;
    let moved = false;
    let last: Drag = { kind: 'draw', date, a, b: a };
    col.setPointerCapture?.(e.pointerId);
    const onMove = (ev: globalThis.PointerEvent) => {
      if (!moved && Math.abs(ev.clientY - y0) < DRAG_THRESHOLD) return;
      moved = true;
      last = { kind: 'draw', date, a, b: minuteAt(col, ev.clientY) };
      setDrag(last);
    };
    const finish = (ev: globalThis.PointerEvent) => {
      col.removeEventListener('pointermove', onMove);
      col.removeEventListener('pointerup', finish);
      col.removeEventListener('pointercancel', finish);
      setDrag(null);
      if (!moved || ev.type === 'pointercancel' || last.kind !== 'draw') return;
      const slot = slotFromDrag(last.a, last.b);
      if (slot) onCreateSlot(date, slot.startTime, slot.endTime);
    };
    col.addEventListener('pointermove', onMove);
    col.addEventListener('pointerup', finish);
    col.addEventListener('pointercancel', finish);
  }
  return (
    <div
      className={`${styles.tg} ${hasUntimed ? styles.tgWithAllDay : ''}`}
      role="group"
      aria-label={t.calendar.timeGrid}
    >
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
          <div
            className={`${styles.tgHead} ${styles.tgAllDay}`}
            role="group"
            aria-label={t.calendar.allDayRow}
          >
            <span className={styles.tgGutter} />
            {perDay.map(({ d, untimed }) => (
              <ul key={d} className={`${styles.tgUntimed} ${single ? styles.tgUntimedWide : ''}`}>
                {(single ? untimed : untimed.slice(0, ALL_DAY_LIMIT)).map((i) => (
                  <li key={`${i.source}:${i.id}`}>
                    {/* Same quiet line as the month (mark + title, a surface only for own events). */}
                    <button
                      type="button"
                      className={`${styles.line} ${i.kind === 'event' && !repeats.has(repeatKey(i)) ? styles.lineOwn : ''} ${repeats.has(repeatKey(i)) ? styles.lineRepeat : ''} ${i.done ? styles.done : ''}`}
                      title={`${kindLabel(i.kind)}: ${i.title}`}
                      style={i.color ? ({ '--cal': i.color } as CSSProperties) : undefined}
                      onClick={() => onOpenItem(i)}
                    >
                      <KindMark item={i} />
                      <span className={styles.lineTitle}>{i.title}</span>
                    </button>
                  </li>
                ))}
                {!single && untimed.length > ALL_DAY_LIMIT ? (
                  <li>
                    <button
                      type="button"
                      className={styles.more}
                      aria-label={`${t.calendar.more(untimed.length - ALL_DAY_LIMIT)}, ${formatDay(d, 'EEEE, d. MMMM')}`}
                      onClick={() => onPickDay(d)}
                    >
                      {t.calendar.more(untimed.length - ALL_DAY_LIMIT)}
                    </button>
                  </li>
                ) : null}
              </ul>
            ))}
          </div>
        ) : null}
        {/* It scrolls, so the keyboard must reach it (U35, WCAG 2.1.1). */}
        <div
          className={styles.tgBody}
          ref={bodyRef}
          role="region"
          aria-label={t.calendar.hoursRegion}
          tabIndex={0}
        >
          <div className={styles.tgHours} aria-hidden="true">
            {HOURS.map((h) => (
              <span key={h}>{`${String(h).padStart(2, '0')}:00`}</span>
            ))}
          </div>
          {perDay.map(({ d, timed }) => {
            const { blocks, stacks } = stackLanes(timed, maxLanes);
            return (
              <div
                key={d}
                data-date={d}
                className={`${styles.tgCol} ${isoWeekday(d) >= 6 ? styles.tgWeekend : ''} ${d === now ? styles.tgToday : ''}`}
                onPointerDown={(e) => startDraw(e, d)}
              >
                {drag?.kind === 'draw' && drag.date === d ? (
                  <span
                    className={styles.tgDraw}
                    aria-hidden="true"
                    style={
                      {
                        '--start': Math.min(drag.a, drag.b),
                        '--minutes': Math.abs(drag.b - drag.a),
                      } as CSSProperties
                    }
                  />
                ) : null}
                {blocks.map(({ item, start, end, lane, lanes }) => {
                  const active = drag && drag.kind !== 'draw' && drag.id === item.id ? drag : null;
                  const dStart = active?.kind === 'move' ? active.dMin : 0;
                  const dLen = active?.kind === 'resize' ? active.dMin : 0;
                  const canDrag = !!onMoveItem && draggable(item);
                  const mins = Math.max(SNAP_MINUTES, end - start + dLen);
                  const short = mins <= SHORT_MINUTES;
                  const lines = textLines(mins, geo);
                  return (
                    <button
                      key={`${item.source}:${item.id}`}
                      type="button"
                      className={`${styles.tgItem} ${styles[`kind_${item.kind}`] ?? ''} ${repeats.has(repeatKey(item)) ? styles.tgRepeat : ''} ${item.done ? styles.done : ''} ${lanes > 1 ? styles.tgConflict : ''} ${short ? styles.tgShort : ''}`}
                      style={
                        {
                          '--start': start + dStart,
                          '--minutes': mins,
                          '--lane': lane,
                          '--lanes': lanes,
                          ...(item.color ? { '--cal': item.color } : {}),
                          ...(active?.kind === 'move' && active.dDays
                            ? { transform: `translateX(${active.dDays * 100}%)` }
                            : {}),
                        } as CSSProperties
                      }
                      aria-keyshortcuts={
                        canDrag
                          ? 'Alt+ArrowUp Alt+ArrowDown Alt+Shift+ArrowUp Alt+Shift+ArrowDown'
                          : undefined
                      }
                      data-dragging={active ? 'true' : undefined}
                      onPointerDown={(e) => startItemDrag(e, item, 'move')}
                      onKeyDown={(e) => onItemKey(e, item)}
                      title={blockTitle(item, lanes > 1)}
                      onClick={() => {
                        if (swallowClick.current) {
                          swallowClick.current = false;
                          return;
                        }
                        onOpenItem(item);
                      }}
                    >
                      <span className={styles.tgLead}>
                        <KindMark item={item} />
                        <span className={styles.tgTime}>{item.time}</span>
                      </span>{' '}
                      {/* A short block: the title beside the time; a longer one: the time's line, then the title. */}
                      <span
                        className={styles.tgTitle}
                        style={
                          { '--lines': short ? lines : Math.max(1, lines - 1) } as CSSProperties
                        }
                      >
                        {item.title}
                      </span>
                      {lanes > 1 ? (
                        <span className={styles.srOnly}>{`, ${t.calendar.overlaps}`}</span>
                      ) : null}
                      {canDrag ? (
                        <span
                          className={styles.tgResize}
                          aria-hidden="true"
                          onPointerDown={(e) => startItemDrag(e, item, 'resize')}
                        />
                      ) : null}
                    </button>
                  );
                })}
                {stacks.map((stack) => {
                  const rows = stackRows(stack.end - stack.start, geo);
                  const shown = stack.items.slice(0, rows);
                  const hidden = stack.items.length - shown.length;
                  const more = `${t.calendar.more(hidden)}, ${formatDay(d, 'EEEE, d. MMMM')}`;
                  return (
                    <div
                      key={`stack:${stack.start}`}
                      className={`${styles.tgStack} ${styles.tgConflict}`}
                      data-stack={stack.items.length}
                      style={
                        {
                          '--start': stack.start,
                          '--minutes': stack.end - stack.start,
                          '--lane': stack.lane,
                          '--lanes': stack.lanes,
                        } as CSSProperties
                      }
                    >
                      {shown.map(({ item }, index) => (
                        <div key={`${item.source}:${item.id}`} className={styles.tgStackRow}>
                          <button
                            type="button"
                            className={`${styles.tgItem} ${styles.tgStacked} ${styles[`kind_${item.kind}`] ?? ''} ${repeats.has(repeatKey(item)) ? styles.tgRepeat : ''} ${item.done ? styles.done : ''}`}
                            style={
                              item.color ? ({ '--cal': item.color } as CSSProperties) : undefined
                            }
                            title={blockTitle(item, true)}
                            onClick={() => onOpenItem(item)}
                          >
                            <span className={styles.tgLead}>
                              <KindMark item={item} />
                              <span className={styles.tgTime}>{item.time}</span>
                            </span>{' '}
                            <span className={styles.tgTitle}>{item.title}</span>
                            <span className={styles.srOnly}>{`, ${t.calendar.overlaps}`}</span>
                          </button>
                          {hidden > 0 && index === shown.length - 1 ? (
                            <button
                              type="button"
                              className={styles.tgMore}
                              aria-label={more}
                              title={more}
                              onClick={() => onPickDay(d)}
                            >
                              {`+${hidden}`}
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  );
                })}
                {d === now ? (
                  <span
                    className={styles.tgNow}
                    aria-hidden="true"
                    style={{ '--start': minutes(nowTime()) } as CSSProperties}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
