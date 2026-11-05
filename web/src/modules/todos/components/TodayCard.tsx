import { t } from '@/strings';
import { Button } from '@/ui';
import { usePageWidthAtLeast } from '@/ui/pageWidth';
import { focusMinutesFor } from '../focus';
import { pickNext, type PickTask } from '../next';
import { viewOf } from '../views';
import type { Task } from '../schema';
import styles from '../routes/todos.module.css';

type CardTask = PickTask & Pick<Task, 'title' | 'startDate'> & { id: string };

/**
 * Focus head of the ToDos: a count box ("11 heute"), the one task that suggests itself as the large line (one line,
 * shortened), and "Anfangen" as the primary action ("Später" moves it out of today); both buttons name the task. Static,
 * no state colour; the numbers are text. Empty day = a calm sentence instead of a zero.
 */
export function TodayCard({
  tasks,
  day,
  focusMinutes = 25,
  onStart,
  onLater,
}: {
  tasks: readonly CardTask[];
  day: string;
  /** Default length of a focus round (the task's own estimate wins). */
  focusMinutes?: number;
  /** "Anfangen" / "Später" for the suggested task; the page owns navigation and the repo. */
  onStart?: (task: CardTask) => void;
  onLater?: (task: CardTask) => void;
}) {
  // C22/F15: a narrow page (phone) keeps the same parts – count, the task title on one line, "Anfangen", "Später" – only
  // the label line, the estimate and the minutes step back. The page container decides, not the window.
  const narrow = usePageWidthAtLeast(40) === false;
  const today = tasks.filter((x) => !x.parentId && viewOf(x, day) === 'today');
  const minutes = today.reduce((sum, x) => sum + (x.estimateMin ?? 0), 0);
  const next = pickNext(today, day);
  const detail = next
    ? next.estimateMin
      ? t.focus.next.about(next.estimateMin)
      : undefined
    : today.length === 0
      ? t.todos.todayCard.done
      : undefined;

  const count = (
    <span className={styles.countBox} data-testid="today-count">
      <strong>{today.length}</strong>
      <span>{t.todos.todayCard.label}</span>
      {minutes > 0 && !narrow ? <span>{t.todos.todayCard.minutes(minutes)}</span> : null}
    </span>
  );
  const startLabel = next
    ? t.focus.next.startMin(focusMinutesFor(next, focusMinutes))
    : t.focus.next.start;

  return (
    <div
      className={styles.todayCard}
      data-testid="today-card"
      data-narrow={narrow ? 'true' : undefined}
    >
      {count}
      <div className={styles.nextTask}>
        {next ? (
          <>
            <span className="sr-only">{t.todos.todayCard.next(next.title)}</span>
            {narrow ? null : (
              <span className={styles.nextLabel} aria-hidden="true">
                {t.todos.todayCard.next('').trim()}
              </span>
            )}
            <strong className={styles.nextTitle} aria-hidden="true" title={next.title}>
              {next.title}
            </strong>
            {detail && !narrow ? <span className={styles.nextDetail}>{detail}</span> : null}
          </>
        ) : (
          <strong className={styles.nextTitle}>{detail}</strong>
        )}
      </div>
      {next && onStart ? (
        <div className={styles.nextActions}>
          <Button
            variant="primary"
            size={narrow ? 'sm' : undefined}
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
              size={narrow ? 'sm' : undefined}
              onClick={() => onLater(next)}
              aria-label={t.todos.todayCard.named(t.focus.next.later, next.title)}
            >
              {t.focus.next.later}
            </Button>
          ) : null}
        </div>
      ) : null}
      <span className="sr-only">{t.todos.todayCard.count(today.length)}</span>
    </div>
  );
}
