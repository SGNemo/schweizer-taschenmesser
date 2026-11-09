import {
  useEffect,
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
  gridScroll,
  groupByDate,
  initialScrollMinute,
  splitDay,
  type GridScrollMemo,
} from '../views';
import { kindLabel } from './ItemRow';
import { sourceHue } from './sourceHue';
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

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Week / day view with an hour grid that fills the available height. Untimed items sit in a row
 * above the grid: in the week at most `ALL_DAY_LIMIT` per day plus "+n weitere" (opens the day), in the day view
 * all of them side by side; the pane scrolls on its own, so the grid keeps its hours (S04, UI round 6). On open the
 * grid scrolls to the current time (or shortly before the first item) without cutting a block at its top edge.
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
    const visibleToday = days.includes(now);
    const blocks = perDay.flatMap((p) => p.timed);
    const first = Math.min(...blocks.map((x) => x.start), 8 * 60);
    const anchor = visibleToday ? minutes(nowTime()) : first;
    body.scrollTop = (initialScrollMinute(blocks, anchor) / 60) * hourPx;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the shown range changes
  }, [rangeKey]);

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
                    <button
                      type="button"
                      className={`${styles.chip} ${styles[`kind_${i.kind}`] ?? ''} ${i.done ? styles.done : ''}`}
                      data-hue={sourceHue(i)}
                      title={`${kindLabel(i.kind)}: ${i.title}`}
                      onClick={() => onOpenItem(i)}
                    >
                      {i.title}
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
        <div className={styles.tgBody} ref={bodyRef}>
          <div className={styles.tgHours} aria-hidden="true">
            {HOURS.map((h) => (
              <span key={h}>{`${String(h).padStart(2, '0')}:00`}</span>
            ))}
          </div>
          {perDay.map(({ d, timed }) => (
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
              {timed.map(({ item, start, end, lane, lanes }) => {
                const active = drag && drag.kind !== 'draw' && drag.id === item.id ? drag : null;
                const dStart = active?.kind === 'move' ? active.dMin : 0;
                const dLen = active?.kind === 'resize' ? active.dMin : 0;
                const canDrag = !!onMoveItem && draggable(item);
                return (
                  <button
                    key={`${item.source}:${item.id}`}
                    type="button"
                    className={`${styles.tgItem} ${styles[`kind_${item.kind}`] ?? ''} ${item.done ? styles.done : ''} ${lanes > 1 ? styles.tgConflict : ''}`}
                    style={
                      {
                        '--start': start + dStart,
                        '--minutes': Math.max(SNAP_MINUTES, end - start + dLen),
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
                    title={`${kindLabel(item.kind)}: ${item.title}${lanes > 1 ? ` – ${t.calendar.overlaps}` : ''}`}
                    onClick={() => {
                      if (swallowClick.current) {
                        swallowClick.current = false;
                        return;
                      }
                      onOpenItem(item);
                    }}
                  >
                    <span className={styles.tgTime}>{item.time}</span> {item.title}
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
