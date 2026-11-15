import { useState } from 'react';
import { formatMinutes, formatNumber } from '@/core/i18n/format';
import { Bars } from '@/ui/charts';
import { addDaysStr, formatDay, relativeDayLabel } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Icon, IconButton, ItemList, ItemRow } from '@/ui';
import { kcalText } from '../data';
import { GROUPS } from '../catalog';
import { weekDays, weekOf } from '../logic';
import { loadByGroup } from '../progress';
import { planDays } from '../plan';
import type { Meal, Session, Template } from '../schema';
import { WeekPlates } from './WeekPlates';
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
  loadedFrom,
  templates = [],
}: {
  day: string;
  weekStart: 1 | 7;
  sessions: readonly Session[];
  meals: readonly Meal[];
  nutrition: boolean;
  /** The first day the page loaded; the arrows never step to a week before it (it would look empty). */
  loadedFrom: string;
  /** Templates with weekdays: the plan's days from today on („laut Plan: Oberkörper“). */
  templates?: readonly Template[];
}) {
  const [offset, setOffset] = useState(0);
  const { from, to } = weekOf(addDaysStr(day, offset * 7), weekStart);
  const days = weekDays(from, sessions, meals, day);
  // Only today and later: a passed plan day is never shown as missed.
  const plan = to >= day ? planDays(templates, sessions, from > day ? from : day, to) : [];
  const planned = (date: string) =>
    plan.filter((p) => p.date === date).map((p) => t.fitness.plan.week(p.template.title));
  const canGoBack = addDaysStr(from, -7) >= weekOf(loadedFrom, weekStart).from;
  const w = t.fitness.week;
  const load = loadByGroup(sessions, { from, to }, [...GROUPS, 'other']);
  const setGroups = load.filter((g) => g.sets);
  // Groups with only a duration (a run) stay a line of text: minutes and sets share no axis.
  const minuteGroups = load
    .filter((g) => !g.sets)
    .map((g) =>
      w.groupMinutes(
        t.fitness.catalog.groups[g.group],
        formatMinutes(g.minutes, { compact: true }),
      ),
    );
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
        <IconButton label={w.prev} disabled={!canGoBack} onClick={() => setOffset((o) => o - 1)}>
          <Icon name="chevronLeft" />
        </IconButton>
        <p className={styles.groupLabel} aria-live="polite">
          {offset === 0 ? w.today : w.range(formatDay(from, 'd. MMM'), formatDay(to, 'd. MMM'))}
        </p>
        <IconButton label={w.next} onClick={() => setOffset((o) => o + 1)}>
          <Icon name="chevronRight" />
        </IconButton>
        {offset !== 0 ? (
          <Button variant="secondary" size="sm" onClick={() => setOffset(0)}>
            {w.today}
          </Button>
        ) : null}
      </div>
      {/* The module's drawing of the running week (it lay in the head before Identity 4.0). */}
      {offset === 0 ? <WeekPlates day={day} weekStart={weekStart} sessions={sessions} /> : null}
      <p className={styles.hint} data-testid="fitness-week-total">
        {w.total}: {line(total)}
      </p>
      {setGroups.length ? (
        <Bars
          title={w.groupsChart}
          showTitle
          data={setGroups.map((g) => ({
            id: g.group,
            label: t.fitness.catalog.groups[g.group],
            value: g.sets,
          }))}
          format={(n) => t.fitness.line.sets(n)}
          data-testid="fitness-week-groups"
        />
      ) : null}
      {minuteGroups.length ? (
        <p className={styles.hint} data-testid="fitness-week-minutes">
          {w.byGroup}: {minuteGroups.join(' · ')}
        </p>
      ) : null}
      {/* The week's kcal as columns: plain amounts, no goal mark (eating is never „over“). */}
      {nutrition && total.kcal > 0 ? (
        <Bars
          title={w.kcalChart}
          showTitle
          orientation="vertical"
          data={days.map((d) => ({
            id: d.date,
            label: formatDay(d.date, 'EEE'),
            value: d.kcal,
          }))}
          format={(n) => `${formatNumber(n)} kcal`}
          data-testid="fitness-week-kcal"
        />
      ) : null}
      <ItemList>
        {days.map((d) => (
          <ItemRow
            key={d.date}
            title={
              d.date === day
                ? `${relativeDayLabel(day, day)}, ${formatDay(d.date, 'd. MMM')}`
                : formatDay(d.date, 'EEEE, d. MMM')
            }
            meta={
              planned(d.date).length
                ? [line(d) === w.nothing ? '' : line(d), ...planned(d.date)]
                    .filter(Boolean)
                    .join(' · ')
                : line(d)
            }
          />
        ))}
      </ItemList>
    </section>
  );
}
