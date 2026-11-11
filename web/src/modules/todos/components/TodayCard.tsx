import { t } from '@/strings';
import { Button } from '@/ui';
import { HeroFigure, HeroSlot } from '@/ui/identity';
import { usePageWidthAtLeast } from '@/ui/pageWidth';
import { focusMinutesFor } from '../focus';
import { pickNext, type PickTask } from '../next';
import { viewOf } from '../views';
import { toDateString } from '@/core/time/now';
import type { Task } from '../schema';
import styles from '../routes/todos.module.css';

type CardTask = PickTask & Pick<Task, 'title' | 'startDate'> & { id: string };

/** What is on today (top-level tasks of the Heute view) and their summed estimate: the head's figure and its line. */
export function todayFigure(
  tasks: readonly CardTask[],
  day: string,
  planner = false,
): { today: CardTask[]; minutes: number } {
  const today = tasks.filter((x) => !x.parentId && viewOf(x, day, planner) === 'today');
  return { today, minutes: today.reduce((sum, x) => sum + (x.estimateMin ?? 0), 0) };
}

/**
 * The first row of the ToDos page: the one task that suggests itself (one line, shortened) with "Anfangen" and
 * "Später"; both buttons name the task. The count of today ("11 heute", with the summed estimate as its context line)
 * is the head's figure, so it stands once. Static, no state colour; an empty day is a calm sentence instead of a zero.
 * While the tasks load the row keeps its height (the phone's "⋯" menu lies beside it).
 */
export function TodayCard({
  tasks: loaded,
  day,
  focusMinutes = 25,
  onStart,
  onLater,
  planner = false,
}: {
  /** `undefined` while the tasks are read. */
  tasks: readonly CardTask[] | undefined;
  day: string;
  /** Default length of a focus round (the task's own estimate wins). */
  focusMinutes?: number;
  /** "Anfangen" / "Später" for the suggested task; the page owns navigation and the repo. */
  onStart?: (task: CardTask) => void;
  onLater?: (task: CardTask) => void;
  /** The planner module is on: it counts what the plan counts (a later plan day wins over an older due date, N02). */
  planner?: boolean;
}) {
  // C22/F15: a narrow page (phone) keeps the task title on one line and both buttons; the label and the estimate
  // step back. The page container decides, not the window.
  const narrow = usePageWidthAtLeast(40) === false;
  const tasks = loaded ?? [];
  const { today, minutes } = todayFigure(tasks, day, planner);
  const next = pickNext(today, day, [], planner);
  const detail = next
    ? next.estimateMin
      ? t.focus.next.about(next.estimateMin)
      : undefined
    : today.length === 0
      ? // A07 (round 5): "erledigt" only when something was really done today.
        tasks.some(
          (x) =>
            x.done && x.completedAt !== undefined && toDateString(new Date(x.completedAt)) === day,
        )
        ? t.todos.todayCard.done
        : t.todos.todayCard.nothing
      : undefined;
  const startLabel = next
    ? t.focus.next.startMin(focusMinutesFor(next, focusMinutes))
    : t.focus.next.start;

  return (
    <>
      {/* The standard head draws no label: the context line names the number ("heute · etwa 45 Min"). An empty
          day shows no zero: the row's sentence says it. */}
      {loaded && today.length > 0 ? (
        <HeroSlot area="figure">
          <HeroFigure
            value={String(today.length)}
            detail={t.todos.todayCard.detail(minutes)}
            testId="today-count"
          />
        </HeroSlot>
      ) : null}
      <div
        className={styles.todayCard}
        data-testid="today-card"
        data-narrow={narrow ? 'true' : undefined}
      >
        <div className={styles.nextTask}>
          {!loaded ? (
            <span aria-hidden="true">{'\u00a0'}</span>
          ) : next ? (
            <>
              <span className="sr-only">{t.todos.todayCard.next(next.title)}</span>
              <span className={styles.nextLabel} aria-hidden="true">
                {t.todos.todayCard.next('').trim()}
              </span>
              <strong className={styles.nextTitle} aria-hidden="true" title={next.title}>
                {next.title}
              </strong>
              {detail && !narrow ? <span className={styles.nextDetail}>{detail}</span> : null}
            </>
          ) : (
            <span className={styles.nextTitle}>{detail}</span>
          )}
        </div>
        {next && onStart ? (
          <div className={styles.nextActions}>
            {/* Not filled: the page's one filled action is "Neue Aufgabe" in the head (rule 4). */}
            <Button
              size="sm"
              onClick={() => onStart(next)}
              aria-label={t.todos.todayCard.named(
                narrow ? t.focus.next.start : startLabel,
                next.title,
              )}
            >
              {narrow ? t.focus.next.start : startLabel}
            </Button>
            {onLater ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onLater(next)}
                aria-label={t.todos.todayCard.named(t.focus.next.later, next.title)}
              >
                {t.focus.next.later}
              </Button>
            ) : null}
          </div>
        ) : null}
        {loaded ? <span className="sr-only">{t.todos.todayCard.count(today.length)}</span> : null}
      </div>
    </>
  );
}
