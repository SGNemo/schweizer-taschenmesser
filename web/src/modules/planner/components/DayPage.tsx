import { type ReactNode, type TouchEvent, useId, useRef, useState } from 'react';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { Card, Icon, ItemList, ItemRow, Progress, SkeletonRows } from '@/ui';
import type { BoardBlocker, BoardDay, BoardRow } from '../board';
import { capacityLabel, capacityState, capacityWhy, compact } from './capacity';
import styles from '../routes/planner.module.css';

/** The first rows of a day are „Zuerst“; what follows is „Danach“. */
export const FIRST_ROWS = 3;
/** „Danach“ shows this many rows, the rest waits behind „n weitere“ … */
export const THEN_ROWS = 5;
/** … unless that would hide fewer than this many: then all of them show. */
const MIN_HIDDEN = 2;
/** A sideways swipe on the sheet (phone) changes the day from this distance. */
const SWIPE_PX = 60;

/** „Heute · Sonntag, 15. November“, „Morgen · Montag, 16. November“, later the date alone. */
export function dayTitle(day: Pick<BoardDay, 'date' | 'isToday'>, tomorrow: boolean): string {
  const full = formatDay(day.date, 'EEEE, d. MMMM');
  return day.isToday
    ? t.planner.board.todayIs(full)
    : tomorrow
      ? t.planner.board.tomorrowIs(full)
      : full;
}

/** A fixed block of the day (an appointment from the calendar, a blocker of the day): recessed, no tick, no menu. */
function BlockRow({ blocker }: { blocker: BoardBlocker }) {
  const time = blocker.from && blocker.to ? `${blocker.from}–${blocker.to}` : undefined;
  return (
    <ItemRow
      recessed
      lead={
        <span className={styles.lead} aria-hidden="true">
          <Icon name="clock" size={20} />
        </span>
      }
      title={blocker.label}
      meta={
        <span className={styles.meta}>
          <span className={styles.source}>
            <Icon name={blocker.calendar ? 'calendar' : 'circleMinus'} size={16} />
            {blocker.calendar ? t.planner.src.appointment : t.planner.row.blocker}
          </span>
          {time ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{time}</span>
            </>
          ) : null}
          <span className={styles.metaDuration}>
            <span aria-hidden="true">· </span>
            {compact(blocker.min)}
          </span>
        </span>
      }
      end={<span className={styles.duration}>{compact(blocker.min)}</span>}
    />
  );
}

/** The sheet while the board is read: the same card, three quiet rows. */
export function DayPageLoading() {
  return (
    <Card className={styles.sheet} aria-busy="true">
      <SkeletonRows count={4} />
    </Card>
  );
}

/**
 * The picked day as one sheet (planner hub R1): its name, its capacity (a text button that opens „Warum?“, R2 –
 * one line and „Zeit ändern“; a day off opens the day's settings) and the bar; then the fixed blocks, „Zuerst“
 * (≤ 3 rows, the first one strong) and „Danach“ (folded on the phone, on the desktop five rows and „n weitere“); a
 * foot with the two steps a day offers.
 */
export function DayPage({
  day,
  tomorrow,
  renderRow,
  onEditDay,
  thenOpen,
  onThenToggle,
  empty,
  onRest,
  onSetup,
  headEnd,
  onSwipe,
  dayEnd,
}: {
  day: BoardDay;
  /** The day after today: its title says „Morgen“. */
  tomorrow: boolean;
  renderRow: (row: BoardRow, next: boolean) => ReactNode;
  onEditDay: () => void;
  thenOpen: boolean;
  onThenToggle: (open: boolean) => void;
  /** What the sheet says while the day holds nothing (an empty state or one calm line). */
  empty: ReactNode;
  /** „Rest verteilen“ – only where it has something to act on (today). */
  onRest?: () => void;
  /** „Tage einteilen“ as a link of the foot; left out where the foot's ⋯ already offers it (phone). */
  onSetup?: () => void;
  /** Beside the day title (the page's ⋯ on the phone). */
  headEnd?: ReactNode;
  /** Phone: a sideways swipe on the sheet, not started on a row (`1` = the next day). */
  onSwipe?: (dir: 1 | -1) => void;
  /** The „Tagesende“ of the settings ('H:mm' as shown), named in the „Warum?“ line when set. */
  dayEnd?: string;
}) {
  const id = useId();
  const [all, setAll] = useState(false);
  // „Warum?“: the one line that says what the day's time goes to; closed until asked.
  const [whyOpen, setWhyOpen] = useState(false);
  const thenRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | undefined>(undefined);
  const first = day.rows.slice(0, FIRST_ROWS);
  const then = day.rows.slice(FIRST_ROWS);
  const folded = !all && then.length - THEN_ROWS >= MIN_HIDDEN;
  const shown = folded ? then.slice(0, THEN_ROWS) : then;
  const state = capacityState(day);
  const hasRows = day.rows.length > 0;
  const editName = t.planner.board.editDay(formatDay(day.date, 'EEEE'));

  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    // Rows swipe by themselves (done / later); controls keep their taps.
    const onRow = e.target instanceof Element && e.target.closest('li, button, a, input');
    start.current = touch && !onRow ? { x: touch.clientX, y: touch.clientY } : undefined;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const from = start.current;
    const touch = e.changedTouches[0];
    start.current = undefined;
    if (!from || !touch || !onSwipe) return;
    const dx = touch.clientX - from.x;
    const dy = touch.clientY - from.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > 2 * Math.abs(dy)) onSwipe(dx < 0 ? 1 : -1);
  };

  return (
    <Card
      className={styles.sheet}
      aria-labelledby={`${id}-title`}
      data-testid={`day-${day.date}`}
      data-today={day.isToday}
      data-off={day.off}
      onTouchStart={onSwipe ? onTouchStart : undefined}
      onTouchEnd={onSwipe ? onTouchEnd : undefined}
    >
      <div className={styles.sheetHead}>
        <h2 id={`${id}-title`} className={styles.sheetTitle}>
          {dayTitle(day, tomorrow)}
        </h2>
        {headEnd ? <span className={styles.headEnd}>{headEnd}</span> : null}
        <span className={styles.capacityLine}>
          {day.off ? (
            // A day off has no question to answer: its capacity opens the day's settings.
            <button
              type="button"
              className={styles.capacityButton}
              aria-label={`${capacityLabel(day)} – ${editName}`}
              onClick={onEditDay}
            >
              {capacityLabel(day)}
            </button>
          ) : (
            // „Warum?“ (R2, P80): the capacity itself is the one control – no second link beside it.
            <button
              type="button"
              className={styles.capacityButton}
              data-testid="planner-why"
              aria-label={t.planner.board.whyName(capacityLabel(day))}
              aria-expanded={whyOpen}
              aria-controls={`${id}-why`}
              onClick={() => setWhyOpen((open) => !open)}
            >
              {capacityLabel(day)}
            </button>
          )}
        </span>
        {!day.off ? (
          <div className={styles.sheetBar}>
            <Progress
              value={day.planned}
              max={Math.max(day.usable, 1)}
              label={t.planner.board.load(compact(day.planned), compact(day.usable))}
              valueText={capacityLabel(day)}
              over={state === 'over' ? 'hatch' : undefined}
              outline
            />
          </div>
        ) : null}
        {!day.off ? (
          <p
            id={`${id}-why`}
            className={styles.whyLine}
            hidden={!whyOpen}
            data-testid="planner-why-line"
          >
            {whyOpen ? (
              <>
                <span>{capacityWhy(day, dayEnd)}</span>{' '}
                <button
                  type="button"
                  className={styles.textLink}
                  aria-label={editName}
                  onClick={onEditDay}
                >
                  {t.planner.board.editTime}
                </button>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      {state === 'over' ? (
        <p className={styles.overLine}>
          <Icon name="alert" size={16} />
          <span>{t.planner.sheet.overLine}</span>
          {onRest ? (
            <button type="button" className={styles.textLink} onClick={onRest}>
              {t.planner.rest.link}
            </button>
          ) : null}
        </p>
      ) : null}

      {day.blockers.length > 0 ? (
        <ItemList label={t.planner.day.blockers}>
          {day.blockers.map((b) => (
            <BlockRow key={b.id} blocker={b} />
          ))}
        </ItemList>
      ) : null}

      {hasRows ? (
        <>
          <h3 className={`${styles.groupHead} ${styles.groupFirst}`}>{t.planner.sheet.first}</h3>
          <ItemList label={t.planner.sheet.first}>
            {first.map((row, i) => renderRow(row, i === 0))}
          </ItemList>
        </>
      ) : (
        empty
      )}

      {then.length > 0 ? (
        <>
          <h3 className={styles.groupHead}>
            <button
              type="button"
              className={styles.fold}
              aria-expanded={thenOpen}
              aria-controls={`${id}-then`}
              onClick={() => onThenToggle(!thenOpen)}
            >
              <Icon name={thenOpen ? 'chevronDown' : 'chevronRight'} size={16} />
              <span className={styles.foldWide}>
                {t.planner.sheet.then(
                  then.length,
                  compact(then.reduce((n, r) => n + r.minutes, 0)),
                )}
              </span>
              <span className={styles.foldNarrow}>{t.planner.sheet.thenFold(then.length)}</span>
            </button>
          </h3>
          <div id={`${id}-then`} ref={thenRef} hidden={!thenOpen}>
            {thenOpen ? (
              <>
                <ItemList label={t.planner.sheet.thenFold(then.length)}>
                  {shown.map((row) => renderRow(row, false))}
                </ItemList>
                {folded ? (
                  <button
                    type="button"
                    className={`${styles.fold} ${styles.more}`}
                    data-testid="planner-more"
                    onClick={() => {
                      setAll(true);
                      // The button goes: the focus moves on to the first row it brought.
                      requestAnimationFrame(() => {
                        const rows = thenRef.current?.querySelectorAll<HTMLElement>('[data-row]');
                        rows?.item(THEN_ROWS)?.focus();
                      });
                    }}
                  >
                    <Icon name="chevronDown" size={16} />
                    {t.planner.sheet.more(then.length - THEN_ROWS)}
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </>
      ) : null}

      {hasRows && (onRest || onSetup) ? (
        <div className={styles.sheetFoot}>
          {hasRows && onRest ? (
            <span data-testid="rest-link">
              <button type="button" className={styles.textLink} onClick={onRest}>
                {t.planner.rest.link}
              </button>
            </span>
          ) : null}
          {hasRows && onSetup ? (
            <button type="button" className={styles.textLink} onClick={onSetup}>
              {t.planner.daySetup.open}
            </button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
