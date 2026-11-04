import { t } from '@/strings';
import styles from './NewDot.module.css';

/** The quiet "new changes" mark: a dot with an accessible name, never a number or a pop-up. */
export function NewDot({ floating = false }: { floating?: boolean }) {
  return (
    <span
      className={[styles.dot, floating ? styles.floating : ''].join(' ')}
      role="img"
      aria-label={t.about.changes.fresh}
      data-testid="new-dot"
    />
  );
}
