import { useMediaQuery } from '@/ui';
import { HeroFigure } from '@/ui/identity';
import { t } from '@/strings';
import { pickNext, type PickTask } from '../next';
import { viewOf } from '../views';
import type { Task } from '../schema';
import styles from '../routes/todos.module.css';

type CardTask = PickTask & Pick<Task, 'title' | 'startDate'>;

/**
 * Signature of the ToDos head: what is on today in one card – the count as the big figure, the
 * summed estimate and the one task that suggests itself as the context line. Static, no state colour;
 * the numbers are text. Empty day = a calm sentence instead of a zero.
 */
export function TodayCard({ tasks, day }: { tasks: readonly CardTask[]; day: string }) {
  // A phone keeps the head short: one line instead of the three-line figure.
  const narrow = useMediaQuery('(max-width: 700px)');
  const today = tasks.filter((x) => !x.parentId && viewOf(x, day) === 'today');
  const minutes = today.reduce((sum, x) => sum + (x.estimateMin ?? 0), 0);
  const next = pickNext(today, day);
  const detail = next
    ? t.todos.todayCard.next(next.title)
    : today.length === 0
      ? t.todos.todayCard.done
      : undefined;
  if (narrow)
    return (
      <p className={styles.todayLine} data-testid="today-card">
        <strong data-testid="today-count">{today.length}</strong> {t.todos.todayCard.label}
        {minutes > 0 ? ` · ${t.todos.todayCard.minutes(minutes)}` : ''}
        <span className="sr-only">{`. ${t.todos.todayCard.count(today.length)}`}</span>
      </p>
    );
  return (
    <div className={styles.todayCard} data-testid="today-card">
      <HeroFigure
        label={t.todos.todayCard.label}
        value={String(today.length)}
        unit={minutes > 0 ? t.todos.todayCard.minutes(minutes) : undefined}
        detail={detail}
        testId="today-count"
      />
      <span className="sr-only">{t.todos.todayCard.count(today.length)}</span>
    </div>
  );
}
