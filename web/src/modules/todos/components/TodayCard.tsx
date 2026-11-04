import { t } from '@/strings';
import { Button, Icon, useMediaQuery } from '@/ui';
import { focusMinutesFor } from '../focus';
import { pickNext, type PickTask } from '../next';
import { viewOf } from '../views';
import type { Task } from '../schema';
import styles from '../routes/todos.module.css';

type CardTask = PickTask & Pick<Task, 'title' | 'startDate'> & { id: string };

/**
 * Focus head of the ToDos: a count box ("11 heute"), the one task that suggests itself as the large line, and
 * "Anfangen" as the primary action ("Später" moves it out of today). Static, no state colour; the numbers are
 * text. Empty day = a calm sentence instead of a zero.
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
  // A phone keeps the head short: the count line and the action, no second row.
  const narrow = useMediaQuery('(max-width: 700px)');
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
      {minutes > 0 ? <span>{t.todos.todayCard.minutes(minutes)}</span> : null}
    </span>
  );
  const startLabel = next
    ? t.focus.next.startMin(focusMinutesFor(next, focusMinutes))
    : t.focus.next.start;

  if (narrow)
    return (
      <div className={styles.todayLine} data-testid="today-card">
        {count}
        <span className="sr-only">{`. ${t.todos.todayCard.count(today.length)}`}</span>
        {next && onStart ? (
          <Button size="sm" variant="primary" onClick={() => onStart(next)}>
            <Icon name="play" size={16} />
            {t.focus.next.start}
          </Button>
        ) : null}
      </div>
    );
  return (
    <div className={styles.todayCard} data-testid="today-card">
      {count}
      <div className={styles.nextTask}>
        {next ? (
          <>
            <span className="sr-only">{t.todos.todayCard.next(next.title)}</span>
            <span className={styles.nextLabel} aria-hidden="true">
              {t.todos.todayCard.next('').trim()}
            </span>
            <strong className={styles.nextTitle} aria-hidden="true">
              {next.title}
            </strong>
            {detail ? <span className={styles.nextDetail}>{detail}</span> : null}
          </>
        ) : (
          <strong className={styles.nextTitle}>{detail}</strong>
        )}
      </div>
      {next && onStart ? (
        <div className={styles.nextActions}>
          <Button variant="primary" onClick={() => onStart(next)}>
            <Icon name="play" size={18} />
            {startLabel}
          </Button>
          {onLater ? (
            <Button variant="ghost" onClick={() => onLater(next)}>
              {t.focus.next.later}
            </Button>
          ) : null}
        </div>
      ) : null}
      <span className="sr-only">{t.todos.todayCard.count(today.length)}</span>
    </div>
  );
}
