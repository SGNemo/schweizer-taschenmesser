import { addDaysStr, formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { isLogged, weekOf } from '../logic';
import type { Session } from '../schema';
import styles from '../fitness.module.css';

/**
 * The head's signature (package 4): the week as seven weight plates, Monday to Sunday (or the user's week
 * start). A day with training is a full plate, a day with only a plan an outline, others a faint ring.
 * Still, no count that grows, no streak, no colour for „missed“; the label says it in words.
 */
export function WeekPlates({
  day,
  weekStart,
  sessions,
}: {
  day: string;
  weekStart: 1 | 7;
  sessions: readonly Pick<Session, 'date' | 'planned'>[];
}) {
  const { from } = weekOf(day, weekStart);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysStr(from, i);
    const own = sessions.filter((s) => s.date === date);
    const state = own.some(isLogged) ? 'done' : own.length && date >= day ? 'planned' : 'none';
    return { date, state, short: formatDay(date, 'EEEEEE') };
  });
  const list = (state: string) =>
    days
      .filter((d) => d.state === state)
      .map((d) => formatDay(d.date, 'EEEE'))
      .join(', ');
  return (
    <div
      className={styles.plates}
      role="img"
      aria-label={t.fitness.plates.label(list('done'), list('planned'))}
      data-testid="fitness-plates"
    >
      {days.map((d) => (
        <span
          key={d.date}
          className={styles.plate}
          data-state={d.state}
          data-today={d.date === day || undefined}
        >
          <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false">
            <circle cx="16" cy="16" r="13" />
            <circle cx="16" cy="16" r="3.2" className={styles.plateHole} />
          </svg>
          <span aria-hidden="true">{d.short}</span>
        </span>
      ))}
    </div>
  );
}
