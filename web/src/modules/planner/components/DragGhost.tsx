import { t } from '@/strings';
import { useDragState } from './dragMove';
import styles from './DragGhost.module.css';

/**
 * The dragged row's title under the pointer (package 5). Decoration only: the drop is said by its toast, the way
 * without a pointer is „Verschieben …“ / `M`. It follows the pointer (direct manipulation) and never animates.
 */
export function DragGhost() {
  const drag = useDragState();
  if (!drag || drag.lifted) return null;
  return (
    <div
      className={styles.ghost}
      aria-hidden="true"
      data-testid="drag-ghost"
      style={{ transform: `translate(${drag.x + 12}px, ${drag.y + 12}px)` }}
    >
      <span className={styles.title}>{drag.title}</span>
      <span className={styles.hint}>{drag.over ? t.planner.drag.drop : t.planner.drag.pick}</span>
    </div>
  );
}
