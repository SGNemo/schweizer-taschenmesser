import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { relativeDayLabel, today } from '@/core/time/dates';
import { t } from '@/strings';
import { compareTasks, dueTone } from '../logic';
import { taskRepo } from '../repo';
import styles from './widget.module.css';

export default function OpenTasksWidget() {
  const open = useLiveQuery(
    async () => (await taskRepo.active().toArray()).filter((x) => !x.done).sort(compareTasks),
    [],
  );
  if (!open) return <p role="status">…</p>;
  if (open.length === 0) return <p className={styles.muted}>{t.todos.widgetEmpty}</p>;
  const now = today();
  return (
    <div>
      <p className={styles.count}>{t.todos.openCount(open.length)}</p>
      <ul className={styles.list}>
        {open.slice(0, 5).map((task) => {
          const tone = dueTone(task.dueDate, task.done, now);
          return (
            <li key={task.id} className={styles.item}>
              <span className={styles.title}>{task.title}</span>
              {task.dueDate ? (
                <span className={`${styles.meta} ${tone === 'overdue' ? styles.overdue : ''}`}>
                  {relativeDayLabel(task.dueDate, now)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Link to="/todos">{t.todos.title}</Link>
    </div>
  );
}
