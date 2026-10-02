import type { ReactNode } from 'react';
import { t } from '@/strings';
import { Button } from './Button';
import styles from './SelectionBar.module.css';

/**
 * Bulk bar above a list in selection mode: "N ausgewählt", the actions as buttons
 * (Erledigt · Verschieben · Löschen …) and Abbrechen last.
 */
export function SelectionBar({
  count,
  onCancel,
  children,
}: {
  count: number;
  onCancel: () => void;
  /** The bulk actions, usually `Button`s. */
  children?: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className={styles.bar} role="region" aria-label={t.ui.selection}>
      <span className={styles.count} aria-live="polite">
        {t.ui.selected(count)}
      </span>
      <div className={styles.actions}>
        {children}
        <Button variant="ghost" onClick={onCancel}>
          {t.actions.cancel}
        </Button>
      </div>
    </div>
  );
}
