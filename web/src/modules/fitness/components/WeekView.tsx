import { useState } from 'react';
import { formatMinutes } from '@/core/i18n/format';
import { addDaysStr, formatDay, relativeDayLabel } from '@/core/time/dates';
import { t } from '@/strings';
import { Icon, IconButton, ItemList, ItemRow } from '@/ui';
import { kcalText } from '../data';
import { weekDays, weekOf } from '../logic';
import type { Meal, Session } from '../schema';
import styles from '../fitness.module.css';

/**
 * The week, roughly (package 2): one row per day with logged sessions, planned ones and kcal – plain
 * numbers, no averages against a goal, no colour for „good“ or „bad“ days. Arrows step through weeks.
 */
export function WeekView({
  day,
  weekStart,
  sessions,
  meals,
  nutrition,
}: {
  day: string;
  weekStart: 1 | 7;
  sessions: readonly Session[];
  meals: readonly Meal[];
  nutrition: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const { from, to } = weekOf(addDaysStr(day, offset * 7), weekStart);
  const days = weekDays(from, sessions, meals);
  const w = t.fitness.week;
  const total = days.reduce(
    (a, d) => ({
      sessions: a.sessions + d.sessions,
      minutes: a.minutes + d.minutes,
      kcal: a.kcal + d.kcal,
    }),
    { sessions: 0, minutes: 0, kcal: 0 },
  );
  const line = (d: {
    sessions: number;
    minutes: number;
    planned?: number;
    kcal: number;
    meals?: number;
  }) =>
    [
      d.sessions
        ? w.sessions(d.sessions, d.minutes ? formatMinutes(d.minutes, { compact: true }) : '')
        : '',
      d.planned ? w.planned(d.planned) : '',
      nutrition && (d.meals ?? d.kcal) ? w.kcal(kcalText(d.kcal)) : '',
    ]
      .filter(Boolean)
      .join(' · ') || w.nothing;
  return (
    <section aria-label={w.label} data-testid="fitness-week-view">
      <div className={styles.toolbar}>
        <IconButton label={w.prev} onClick={() => setOffset((o) => o - 1)}>
          <Icon name="chevronLeft" />
        </IconButton>
        <p className={styles.groupLabel} aria-live="polite">
          {offset === 0 ? w.today : w.range(formatDay(from, 'd. MMM'), formatDay(to, 'd. MMM'))}
        </p>
        <IconButton label={w.next} onClick={() => setOffset((o) => o + 1)}>
          <Icon name="chevronRight" />
        </IconButton>
      </div>
      <p className={styles.hint} data-testid="fitness-week-total">
        {w.total}: {line(total)}
      </p>
      <ItemList>
        {days.map((d) => (
          <ItemRow
            key={d.date}
            title={
              d.date === day
                ? `${relativeDayLabel(day, day)}, ${formatDay(d.date, 'd. MMM')}`
                : formatDay(d.date, 'EEEE, d. MMM')
            }
            meta={line(d)}
          />
        ))}
      </ItemList>
    </section>
  );
}
