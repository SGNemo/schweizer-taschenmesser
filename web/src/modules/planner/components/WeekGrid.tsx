import { type KeyboardEvent, useRef } from 'react';
import { dayName } from '@/core/plan/explain';
import { addDaysStr, formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import type { BoardDay } from '../board';
import { capacityShort, capacityState } from './capacity';
import { isPassed, thingCount, tileName } from './WeekBand';
import styles from './WeekGrid.module.css';

/**
 * „4 Wochen“ (planner rethink, package 4): four weeks from a Monday as a grid of days. A cell names its date, its
 * load and its state; it shows the number of things, „+ … mehr“ on an overbooked day and „offen“ on a passed day
 * that still holds something – never a figure for the passed. A cell picks the day like a tile of the band.
 * Keyboard: one tab stop, the arrow keys move by day and week, Home/End to the row's ends.
 */
export function WeekGrid({
  days,
  picked,
  today,
  onPick,
}: {
  days: readonly BoardDay[];
  picked: string | undefined;
  today: string;
  onPick: (date: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, w) =>
    days.slice(w * 7, w * 7 + 7),
  );
  const stop = days.some((d) => d.date === picked)
    ? picked
    : (days.find((d) => d.date >= today)?.date ?? days[0]?.date);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const cells = [...(box.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const at = cells.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 7,
      ArrowUp: -7,
      Home: -(at % 7),
      End: 6 - (at % 7),
    };
    if (!(e.key in step)) return;
    const to = at + step[e.key]!;
    if (to < 0 || to >= cells.length) return;
    e.preventDefault();
    cells[to]?.focus();
  };
  return (
    <div
      ref={box}
      className={styles.grid}
      role="grid"
      aria-label={t.planner.board.gridLabel}
      onKeyDown={onKeyDown}
      data-testid="week-grid"
    >
      {weeks.map((week) => (
        <div key={week[0]!.date} role="row" className={styles.row}>
          {week.map((d) => {
            const passed = isPassed(d, today);
            const n = thingCount(d);
            const over = !passed && capacityState(d) === 'over';
            const word = passed
              ? d.rows.length > 0
                ? t.planner.board.open
                : ''
              : over
                ? capacityShort(d)
                : '';
            return (
              <div key={d.date} role="gridcell" className={styles.cell}>
                <button
                  type="button"
                  className={styles.pick}
                  data-testid={`week-${d.date}`}
                  data-passed={passed || undefined}
                  aria-current={d.isToday ? 'date' : undefined}
                  aria-pressed={d.date === picked}
                  tabIndex={d.date === stop ? 0 : -1}
                  onClick={() => onPick(d.date)}
                >
                  <span className="sr-only">
                    {tileName(d, d.date === addDaysStr(today, 1), today)}
                  </span>
                  <span aria-hidden="true" className={styles.head}>
                    <span className={styles.weekday}>{dayName(d.date)}</span>
                    <span className={styles.number}>{formatDay(d.date, 'd.')}</span>
                  </span>
                  <span aria-hidden="true" className={styles.facts}>
                    {n > 0 && !passed ? <span>{t.planner.board.things(n)}</span> : null}
                    {word ? <span>{word}</span> : null}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
