import { Link } from 'react-router';
import { useLinks } from '@/core/entitylinks';
import { t } from '@/strings';
import { Icon } from '@/ui';
import styles from '../routes/calendar.module.css';

/**
 * „Vorbereitung: Unterlagen mitnehmen · erledigt“ (planner hub S5, P52): the ToDos that link to this event – made
 * with „Als ToDo merken“, or anywhere else – read from the other end through the link table (`useLinks`, the
 * reverse direction). Each opens its ToDo; its done state is the ToDo's own (a link writes no state). Only live
 * ToDos are listed: one that is gone or whose module is off is no preparation to show. Nothing while loading and
 * nothing for an event without one, so the editor stays as it was. `onLeave` runs before a link navigates.
 */
export function EventTodos({ eventId, onLeave }: { eventId: string; onLeave?: () => void }) {
  const links = useLinks({ module: 'calendar', id: eventId });
  const todos = (links ?? []).flatMap((l) =>
    l.direction === 'in' && l.other.module === 'todos' && l.state.state === 'alive'
      ? [{ id: l.id, ...l.state }]
      : [],
  );
  if (todos.length === 0) return null;
  const p = t.calendar.preparation;
  return (
    <ul className={styles.itemList} aria-label={p.label} data-testid="event-todos">
      {todos.map((todo) => (
        <li key={todo.id}>
          {p.label}:{' '}
          <Link to={todo.to} onClick={onLeave} aria-label={p.open(todo.title)}>
            {todo.title}
          </Link>
          {todo.done ? (
            <span className={styles.muted}>
              {' · '}
              <Icon name="check" size={14} />
              {p.done}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
