import { useEffect, useMemo, useRef, useState } from 'react';
import type { Stored } from '@/core/db/types';
import { weekdayShort } from '@/core/recurrence/describe';
import { formatDay, today as todayStr, addDaysStr } from '@/core/time/dates';
import { useFocusSettings } from '@/core/settings/focus';
import { t } from '@/strings';
import { byDate, heatmap, longestRun, perWeekday, rate } from '../logic';
import type { Entry, Goal } from '../schema';
import styles from '../habits.module.css';

const STATES = ['done', 'partial', 'open', 'rest'] as const;

/**
 * The goal picker of the "Verlauf" tab with the picked goal's history below it.
 */
export function History({
  goals,
  entries,
  weekStart,
}: {
  goals: Stored<Goal>[];
  entries: Stored<Entry>[];
  weekStart: 1 | 7;
}) {
  const [pick, setPick] = useState<string | undefined>(undefined);
  const goal = goals.find((g) => g.id === pick) ?? goals[0];
  if (!goal) return null;
  return (
    <div>
      <div className={styles.viewBar} role="group" aria-label={t.habits.history.pick}>
        {goals.map((g) => (
          <button
            key={g.id}
            type="button"
            className={styles.chip}
            aria-pressed={g.id === goal.id}
            onClick={() => setPick(g.id)}
          >
            {g.name}
          </button>
        ))}
      </div>
      <GoalHistory goal={goal} entries={entries} weekStart={weekStart} />
    </div>
  );
}

/**
 * The year grid and a few calm numbers for one goal: a cell per day (colour **and** a hatch for
 * rest days, a text per cell), the last 30 days as "x of y planned days", the share per weekday.
 * Rest days never count against the numbers; the longest run only shows when the streak setting is on.
 * Used by the "Verlauf" tab and by the detail panel of the wide page.
 */
export function GoalHistory({
  goal,
  entries,
  weekStart,
  compact = false,
}: {
  goal: Stored<Goal>;
  entries: Stored<Entry>[];
  weekStart: 1 | 7;
  /** The detail panel: the last 30 days and the weekdays only; the year grid stays on the "Verlauf" tab. */
  compact?: boolean;
}) {
  const [focus] = useFocusSettings();
  const heatRef = useRef<HTMLDivElement>(null);
  const day = todayStr();
  const map = useMemo(() => byDate(entries, goal.id), [entries, goal]);
  const goalId = goal.id;
  // The newest week is on the right: start there, older weeks are a swipe away.
  useEffect(() => {
    const el = heatRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [goalId]);
  const grid = heatmap(goal, map, day, 53, weekStart);
  const last30 = rate(goal, map, addDaysStr(day, -29), day);
  const per = perWeekday(goal, map, addDaysStr(day, -180), day);
  const run = longestRun(goal, map, addDaysStr(day, -365), day);
  // In the detail panel the goal's name is the h2; the sections lie one level below it.
  const Heading = compact ? 'h3' : 'h2';
  return (
    <>
      {compact ? null : (
        <section className={styles.section} aria-label={t.habits.history.grid}>
          <h2 className={styles.sectionTitle}>{t.habits.history.grid}</h2>
          <div ref={heatRef} className={styles.heat} role="img" aria-label={t.habits.history.grid}>
            {grid.flat().map((c) => (
              <span
                key={c.date}
                className={styles.cell}
                data-state={c.date > day ? 'off' : c.state}
                title={t.habits.history.cell(
                  formatDay(c.date, 'EEE, d. MMM yyyy'),
                  t.habits.history.legend[c.state],
                  c.count,
                )}
              />
            ))}
          </div>
          <ul className={styles.legend}>
            {STATES.map((s) => (
              <li key={s}>
                <span className={styles.cell} data-state={s} aria-hidden="true" />
                {t.habits.history.legend[s]}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <Heading className={styles.sectionTitle}>{t.habits.history.last30}</Heading>
        <p data-testid="habit-rate">
          {last30
            ? goal.period === 'week'
              ? t.habits.history.ofWeeks(last30.done, last30.of)
              : t.habits.history.ofDays(last30.done, last30.of)
            : t.habits.history.noData}
        </p>
        {focus.streaks && run > 0 ? <p>{t.habits.history.best(run)}</p> : null}
      </section>

      {goal.period === 'day' ? (
        <section className={styles.section}>
          <Heading className={styles.sectionTitle}>{t.habits.history.perWeekday}</Heading>
          <ul className={styles.weekdays}>
            {per.map((share, i) => (
              <li key={i} className={styles.weekdayRow}>
                <span>{weekdayShort(i + 1)}</span>
                <span className={styles.bar} aria-hidden="true">
                  <span
                    className={styles.barFill}
                    style={{ width: `${Math.round((share ?? 0) * 100)}%`, display: 'block' }}
                  />
                </span>
                <span>{share === null ? '–' : `${Math.round(share * 100)} %`}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
