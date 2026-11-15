import { useMemo, useState } from 'react';
import { formatMinutes, formatNumber } from '@/core/i18n/format';
import { formatDay, relativeDayLabel } from '@/core/time/dates';
import { Trend } from '@/ui/charts';
import { t } from '@/strings';
import { SignatureMark } from '@/ui/identity';
import { Dialog, EmptyState, GroupedList, ItemList, ItemRow, TextField } from '@/ui';
import { GROUPS, patternOf, type Group } from '../catalog';
import { exerciseDetail, setsDetail, useSessions } from '../data';
import {
  exerciseHistory,
  exerciseOverview,
  isBestEntry,
  reachesBest,
  trendOf,
  type Best,
  type ExerciseSummary,
} from '../progress';
import type { Session } from '../schema';
import { ExercisePicto } from './ExercisePicto';
import styles from '../fitness.module.css';

const ORDER: readonly (Group | 'other')[] = [...GROUPS, 'other'];
/** The history in the dialog stops here; the rest is counted. */
const HISTORY_ROWS = 30;

/** „Bestwert 85 kg × 6“, „Bestwert 12 Wdh.“, „Am längsten 45 Min“. */
export function bestText(best: Best): string {
  const x = t.fitness.exercises;
  if (best.kind === 'weight') return x.bestWeight(formatNumber(best.kg), best.reps);
  if (best.kind === 'reps') return x.bestReps(best.reps);
  return x.bestMinutes(formatMinutes(best.minutes, { compact: true }));
}

/**
 * „Übungen“ (deep package 1): every exercise ever logged, by muscle group, with its last values and its
 * personal best; a search narrows the list; a tap opens the history. Plain facts, no judgement.
 */
export function ExercisesView({ day }: { day: string }) {
  // Every session, not only the page's 90 days: a best from last year is still a best.
  const sessions = useSessions();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const all = useMemo(() => exerciseOverview(sessions ?? []), [sessions]);
  const x = t.fitness.exercises;
  if (!sessions) return null;
  if (all.length === 0)
    return (
      <EmptyState
        title={x.empty}
        testId="fitness-exercises-empty"
        motif={<SignatureMark id="dumbbell" size={64} />}
      >
        <p>{x.emptyHint}</p>
      </EmptyState>
    );
  const q = query.trim().toLocaleLowerCase();
  const shown = q ? all.filter((e) => e.name.toLocaleLowerCase().includes(q)) : all;
  const row = (e: ExerciseSummary) => (
    <ItemRow
      key={e.name}
      title={e.name}
      lead={<ExercisePicto pattern={patternOf(e.name)} />}
      meta={[
        x.last(relativeDayLabel(e.last.date, day), exerciseDetail(e.last.exercise)),
        // The last time reached the best: one word instead of the same numbers twice.
        e.best ? (reachesBest(e.last, e.best) ? x.bestMark : bestText(e.best)) : '',
      ]
        .filter(Boolean)
        .join(' · ')}
      onOpen={() => setOpen(e.name)}
    />
  );
  return (
    <section aria-label={x.label} data-testid="fitness-exercises">
      <div className={`${styles.toolbar} ${styles.search}`}>
        <TextField
          label={x.search}
          labelHidden
          placeholder={x.search}
          type="search"
          data-list-search
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {shown.length === 0 ? (
        <p className={styles.hint} role="status">
          {x.noMatch}
        </p>
      ) : (
        <GroupedList
          listId="fitness-exercises"
          label={x.label}
          groups={ORDER.flatMap((g) => {
            const items = shown.filter((e) => e.group === g);
            return items.length
              ? [
                  {
                    id: g,
                    label: t.fitness.catalog.groups[g],
                    count: items.length,
                    children: <ItemList>{items.map(row)}</ItemList>,
                  },
                ]
              : [];
          })}
        />
      )}
      <ExerciseDialog
        name={open}
        day={day}
        sessions={sessions}
        summary={all.find((e) => e.name === open)}
        onClose={() => setOpen(null)}
      />
    </section>
  );
}

/** One exercise: its best and every time it was done, newest first; the best's row is marked in words. */
function ExerciseDialog({
  name,
  day,
  sessions,
  summary,
  onClose,
}: {
  name: string | null;
  day: string;
  sessions: readonly Session[];
  summary: ExerciseSummary | undefined;
  onClose: () => void;
}) {
  const x = t.fitness.exercises;
  const history = name ? exerciseHistory(sessions, name) : [];
  const trend = trendOf(history);
  const unit = (n: number) =>
    trend?.kind === 'weight'
      ? t.fitness.line.weight(formatNumber(n))
      : trend?.kind === 'reps'
        ? t.fitness.line.reps(n)
        : formatMinutes(n, { compact: true });
  return (
    <Dialog open={name !== null && !!summary} onClose={onClose} title={name ?? ''}>
      {summary ? (
        <>
          <p className={styles.result} data-testid="fitness-exercise-best">
            {[summary.best ? bestText(summary.best) : '', x.times(summary.times)]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {/* One point is a sentence (the best above), a course needs two. */}
          {trend && trend.points.length >= 2 ? (
            <Trend
              title={x.trend[trend.kind]}
              showTitle
              // With the year once the course spans more than one.
              labels={trend.points.map((p) =>
                formatDay(
                  p.date,
                  trend.points[0]!.date.slice(0, 4) === trend.points.at(-1)!.date.slice(0, 4)
                    ? 'd. MMM'
                    : 'd. MMM yy',
                ),
              )}
              series={[{ label: name ?? '', values: trend.points.map((p) => p.value) }]}
              format={unit}
              data-testid="fitness-exercise-trend"
            />
          ) : null}
          <p className={styles.groupLabel}>{x.history}</p>
          <ItemList>
            {history.slice(0, HISTORY_ROWS).map((h, i) => (
              <ItemRow
                key={`${h.date}-${i}`}
                title={relativeDayLabel(h.date, day)}
                meta={[setsDetail(h.exercise), isBestEntry(h, summary.best) ? x.bestMark : '']
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))}
          </ItemList>
          {history.length > HISTORY_ROWS ? (
            <p className={styles.hint}>{x.historyMore(history.length - HISTORY_ROWS)}</p>
          ) : null}
        </>
      ) : null}
    </Dialog>
  );
}
