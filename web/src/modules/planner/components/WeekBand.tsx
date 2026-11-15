import { type KeyboardEvent, useRef } from 'react';
import { dayName } from '@/core/plan/explain';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { Progress } from '@/ui';
import type { BoardDay } from '../board';
import { capacityLabel, capacityShort, capacityState, capacityTile, compact } from './capacity';
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

/** A tile's accessible name: „Morgen, Montag, 16. November: 37 Min frei von 3 h 12 · 9 Dinge“. */
export function tileName(day: BoardDay, tomorrow: boolean): string {
  const n = thingCount(day);
  return t.planner.board.tileName(
    dayWords(day, tomorrow),
    capacityLabel(day),
    n > 0 ? t.planner.board.things(n) : '',
  );
}

/**
 * The week as a band of seven tiles (planner hub R1): day, number of things, free time and a bar whose track length
 * is the day's capacity on the week's scale. A tile picks the day shown in the sheet. One tab stop; ←/→/Home/End
 * move the focus, Enter or Space picks. Below 44 rem of its own width the tiles take the compact form.
 */
export function WeekBand({
  days,
  picked,
  onPick,
}: {
  days: readonly BoardDay[];
  picked: string | undefined;
  onPick: (date: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
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
      <div
        ref={box}
        className={styles.band}
        role="group"
        aria-label={t.planner.board.label}
        onKeyDown={onKeyDown}
      >
        {days.map((d, i) => {
          const n = thingCount(d);
          const state = capacityState(d);
          const number = formatDay(d.date, 'd.');
          return (
            // The tile is a box with the button over all of it and the bar laid on top (a bar is a `div`: it may
            // not stand inside a button). The bar takes no pointer, so the whole tile answers.
            <div key={d.date} className={styles.tile} data-off={d.off || undefined}>
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
                <span className="sr-only">{tileName(d, i === 1)}</span>
                <span className={styles.wide} aria-hidden="true">
                  <span className={styles.top}>
                    <span className={styles.day}>
                      {d.isToday
                        ? t.planner.board.todayIs(`${dayName(d.date)} ${number}`)
                        : `${dayName(d.date)} ${number}`}
                    </span>
                    {n > 0 ? (
                      <span className={styles.count}>{t.planner.board.things(n)}</span>
                    ) : null}
                  </span>
                  <span className={styles.state}>{capacityTile(d)}</span>
                </span>
                <span className={styles.compact} aria-hidden="true">
                  <span className={styles.day}>{dayName(d.date)}</span>
                  <span className={styles.day}>{formatDay(d.date, 'd')}</span>
                  {/* The count of things, else what the day has: its free time or one state word („frei“). */}
                  <span className={styles.state}>{n > 0 ? n : capacityShort(d)}</span>
                </span>
              </button>
              {/* The button's name says the load in words; the bar is its picture. */}
              <div className={styles.bar} aria-hidden="true">
                <Progress
                  value={d.off ? 0 : d.planned}
                  max={Math.max(d.usable, 1)}
                  label={t.planner.board.load(compact(d.planned), compact(d.usable))}
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
    </div>
  );
}
