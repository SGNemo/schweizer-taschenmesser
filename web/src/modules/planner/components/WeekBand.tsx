import { type KeyboardEvent, useRef } from 'react';
import { dayName } from '@/core/plan/explain';
import { addDaysStr, formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { Icon, IconButton, Progress } from '@/ui';
import type { BoardDay } from '../board';
import { droppedOn, useDragState, withDropped } from './dragMove';
import { capacityLabel, capacityShort, capacityState, compact } from './capacity';
import styles from './WeekBand.module.css';

/** Things of a day as the tile counts them (blockers are no things; a thing cut into parts counts once). */
export const thingCount = (day: Pick<BoardDay, 'rows'>): number =>
  new Set(day.rows.map((r) => r.itemKey)).size;

/** „Morgen, Montag, 16. November“ – the day as a tile and the status line name it. */
export function dayWords(day: Pick<BoardDay, 'date' | 'isToday'>, tomorrow: boolean): string {
  const full = formatDay(day.date, 'EEEE, d. MMMM');
  return day.isToday
    ? t.planner.board.tileToday(full)
    : tomorrow
      ? t.planner.board.tileTomorrow(full)
      : full;
}

/** A day before today (package 4: a passed day in view): it says „offen“ while it holds something, never a figure. */
export const isPassed = (day: Pick<BoardDay, 'date'>, today: string): boolean => day.date < today;

/** A tile's accessible name: „Morgen, Montag, 16. November: 37 Min frei von 3 h 12 · 9 Dinge“. */
export function tileName(day: BoardDay, tomorrow: boolean, today?: string): string {
  if (today && isPassed(day, today))
    return t.planner.board.cellName(
      dayWords(day, false),
      day.rows.length > 0 ? t.planner.board.open : '',
    );
  const n = thingCount(day);
  return t.planner.board.tileName(
    dayWords(day, tomorrow),
    capacityLabel(day),
    n > 0 ? t.planner.board.things(n) : '',
  );
}

/**
 * The week as a band of seven tiles (planner hub R1): day, number of things (wide form only), free time and a bar
 * whose track length is the day's capacity on the week's scale. A tile picks the day shown in the sheet. One tab stop; ←/→/Home/End
 * move the focus, Enter or Space picks. Below 44 rem of its own width the tiles take the compact form.
 */
export function WeekBand({
  days,
  picked,
  onPick,
  today,
  drop,
  onPrev,
  onNext,
}: {
  days: readonly BoardDay[];
  picked: string | undefined;
  onPick: (date: string) => void;
  /** Today ('YYYY-MM-DD'): a day before it is a passed day („offen“, no load). Default: none is passed. */
  today?: string;
  /** The tiles take a dragged row (package 5; the planner page). */
  drop?: boolean;
  /** ‹ and › at the band's ends (direction A): the week before (left out in this week) and after. */
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useDragState();
  const most = Math.max(1, ...days.map((d) => d.usable));
  // The roving stop: the picked day, else the first tile.
  const stop = days.some((d) => d.date === picked) ? picked : days[0]?.date;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const tiles = [...(box.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const at = tiles.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const to =
      e.key === 'ArrowRight'
        ? Math.min(tiles.length - 1, at + 1)
        : e.key === 'ArrowLeft'
          ? Math.max(0, at - 1)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? tiles.length - 1
              : -1;
    if (to < 0) return;
    e.preventDefault();
    tiles[to]?.focus();
  };

  return (
    <div className={styles.container}>
      <div className={onNext ? styles.paged : undefined}>
        {onNext ? (
          // In this week there is no week before to page to (no paging into the past): ‹ stands, disabled.
          <IconButton
            label={t.planner.board.prev}
            onClick={onPrev ?? (() => undefined)}
            disabled={!onPrev}
            className={styles.nav}
          >
            <Icon name="chevronLeft" size={16} />
          </IconButton>
        ) : null}
        <div
          ref={box}
          className={styles.band}
          role="group"
          aria-label={t.planner.board.label}
          onKeyDown={onKeyDown}
        >
          {days.map((d, i) => {
            const state = capacityState(d);
            const passed = !!today && isPassed(d, today);
            // A row dragged over the tile (package 5): the tile shows the day as it would be – a full one its overbooking.
            const dropped = passed ? null : droppedOn(drag, d.date);
            const shown = dropped === null ? d : withDropped(d, dropped);
            // A passed day: „offen“ while something of it is open, else nothing – never a figure, never a bar.
            const passedWord = passed && d.rows.length > 0 ? t.planner.board.open : '';
            return (
              // The tile is a box with the button over all of it and the bar laid on top (a bar is a `div`: it may
              // not stand inside a button). The bar takes no pointer, so the whole tile answers.
              <div
                key={d.date}
                className={styles.tile}
                data-off={d.off || undefined}
                data-passed={passed || undefined}
                data-over={(!passed && capacityState(shown) === 'over') || undefined}
                data-drop-date={passed || !drop ? undefined : d.date}
                data-drop-over={dropped !== null || undefined}
              >
                <button
                  type="button"
                  className={styles.pick}
                  data-testid={`week-${d.date}`}
                  aria-pressed={d.date === picked}
                  aria-current={d.isToday ? 'date' : undefined}
                  tabIndex={d.date === stop ? 0 : -1}
                  onClick={() => onPick(d.date)}
                >
                  {/* The name is the sentence; the two visible forms are its short picture (hidden from the name,
                    so the tile is not read twice). */}
                  <span className="sr-only">
                    {tileName(d, today ? d.date === addDaysStr(today, 1) : i === 1, today)}
                  </span>
                  {/* Direction A: the day and one fact – the free time, „+ 2 h 10 mehr“, „frei“, „offen“ for a passed day. */}
                  <span className={styles.face} aria-hidden="true">
                    <span className={styles.day}>
                      <span>{dayName(d.date)}</span> <span>{formatDay(d.date, 'd')}</span>
                    </span>
                    <span className={styles.state}>
                      {passed ? passedWord : capacityShort(shown)}
                    </span>
                  </span>
                </button>
                {/* The button's name says the load in words; the bar is its picture (none for a passed day). */}
                <div className={styles.bar} aria-hidden="true" hidden={passed}>
                  <Progress
                    // A topic shown (package 11): the bar is the topic's share; the face and name stay the whole day's.
                    value={d.off ? 0 : (d.bar ?? d.planned)}
                    max={Math.max(d.usable, 1)}
                    label={t.planner.board.load(compact(d.bar ?? d.planned), compact(d.usable))}
                    valueText={capacityLabel(d)}
                    scale={d.off || d.usable === 0 ? 1 : Math.max(0.25, d.usable / most)}
                    over={state === 'over' ? 'hatch' : undefined}
                    outline
                  />
                </div>
              </div>
            );
          })}
        </div>
        {onNext ? (
          <IconButton label={t.planner.board.next} onClick={onNext} className={styles.nav}>
            <Icon name="chevronRight" size={16} />
          </IconButton>
        ) : null}
      </div>
    </div>
  );
}
