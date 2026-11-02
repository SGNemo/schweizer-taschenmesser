import type { Stored } from '@/core/db/types';
import { t } from '@/strings';
import { categoryColor, Dialog } from '@/ui';
import type { Notebook } from '../schema';
import styles from './Dialogs.module.css';

/** Pick the notebook a page moves to ("Allgemein" = none). */
export function MoveDialog({
  open,
  books,
  current,
  onPick,
  onClose,
}: {
  open: boolean;
  books: readonly Stored<Notebook>[];
  current: string | null;
  onPick: (notebookId: string | null) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={t.notes.moveTitle}>
      <ul className={styles.choiceList} aria-label={t.notes.notebooks}>
        <li>
          <button
            type="button"
            className={styles.choice}
            aria-current={current === null}
            onClick={() => onPick(null)}
          >
            {t.notes.general}
          </button>
        </li>
        {books.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              className={styles.choice}
              aria-current={current === b.id}
              onClick={() => onPick(b.id)}
            >
              <span
                className={styles.dot}
                style={{ background: categoryColor(b.tone) }}
                aria-hidden="true"
              />
              {b.name}
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
