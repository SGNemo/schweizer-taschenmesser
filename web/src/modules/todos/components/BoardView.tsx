import { useRef, useState } from 'react';
import type { Stored } from '@/core/db/types';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, RowMenu, type RowMenuItem } from '@/ui';
import { compareTasks } from '../logic';
import type { Task } from '../schema';
import { TODO_VIEWS, viewOf, type TodoView } from '../views';
import styles from '../routes/todos.module.css';

type StoredTask = Stored<Task>;

interface Props {
  tasks: StoredTask[];
  day: string;
  onOpen: (task: StoredTask) => void;
  /** Moves a card into a column (drag, the "⋯" menu, or "Morgen"). */
  onMove: (task: StoredTask, to: TodoView) => void;
  onTomorrow: (task: StoredTask) => void;
}

/**
 * Four columns (Heute · Demnächst · Irgendwann · Erledigt). A card moves by dragging it onto a
 * column or from its "⋯" menu (the keyboard and touch way); every move is one undoable change made by the page.
 */
export function BoardView({ tasks, day, onOpen, onMove, onTomorrow }: Props) {
  const [over, setOver] = useState<TodoView | null>(null);
  // The dragged card's id lives here, not only in the DataTransfer (browsers differ in what they keep).
  const dragged = useRef<string | null>(null);
  const columns = TODO_VIEWS.map((view) => ({
    view,
    cards: tasks.filter((x) => viewOf(x, day) === view).sort(compareTasks),
  }));
  return (
    <>
      <p className={styles.boardHint}>{t.todos.board.hint}</p>
      <div className={styles.board} data-testid="todos-board">
        {columns.map(({ view, cards }) => (
          <section
            key={view}
            data-view={view}
            className={`${styles.column} ${over === view ? styles.columnOver : ''}`}
            aria-label={t.todos.views[view]}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(view);
            }}
            onDragLeave={() => setOver((v) => (v === view ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = dragged.current ?? e.dataTransfer.getData('text/plain');
              dragged.current = null;
              const task = tasks.find((x) => x.id === id);
              if (task && viewOf(task, day) !== view) onMove(task, view);
            }}
          >
            <h3 className={styles.columnTitle}>
              {t.todos.views[view]} <span className={styles.columnCount}>{cards.length}</span>
            </h3>
            {cards.length === 0 ? (
              <p className={styles.columnEmpty}>{t.todos.board.empty}</p>
            ) : null}
            <ul className={styles.cards}>
              {cards.map((task) => (
                <Card
                  key={task.id}
                  task={task}
                  view={view}
                  onOpen={onOpen}
                  onMove={onMove}
                  onTomorrow={onTomorrow}
                  onDragStart={(id) => (dragged.current = id)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function Card({
  task,
  view,
  onOpen,
  onMove,
  onTomorrow,
  onDragStart,
}: {
  task: StoredTask;
  view: TodoView;
  onDragStart: (id: string) => void;
  onOpen: Props['onOpen'];
  onMove: Props['onMove'];
  onTomorrow: Props['onTomorrow'];
}) {
  const [open, setOpen] = useState(false);
  const items: RowMenuItem[] = TODO_VIEWS.filter((v) => v !== view).map((v) => ({
    id: `move-${v}`,
    label: t.todos.board.moveTo(t.todos.views[v]),
    onSelect: () => onMove(task, v),
  }));
  return (
    <li
      className={styles.card}
      draggable
      onDragStart={(e) => {
        onDragStart(task.id);
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <button type="button" draggable className={styles.cardTitle} onClick={() => onOpen(task)}>
        {task.title}
      </button>
      <span className={styles.cardMeta}>
        {task.dueDate ? formatDay(task.dueDate, 'EEE, d. MMM') : null}
        {task.estimateMin ? ` · ${t.todos.estimateMin(task.estimateMin)}` : null}
        {task.tags?.length ? ` · ${task.tags.map((x) => `#${x}`).join(' ')}` : null}
      </span>
      <span className={styles.cardActions}>
        {view === 'today' ? (
          <Button size="sm" variant="ghost" onClick={() => onTomorrow(task)}>
            {t.todos.moveTomorrow}
          </Button>
        ) : null}
        <RowMenu label={t.todos.moreOptions} open={open} onOpenChange={setOpen} items={items} />
      </span>
    </li>
  );
}
