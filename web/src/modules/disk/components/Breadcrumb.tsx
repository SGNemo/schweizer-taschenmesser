import type { DiskNode } from '@/core/platform/disk';
import { t } from '@/strings';
import styles from './Breadcrumb.module.css';

/** Path of the folders entered so far; every entry jumps back to that level. */
export function Breadcrumb({
  trail,
  onJump,
}: {
  trail: readonly DiskNode[];
  onJump: (index: number) => void;
}) {
  return (
    <nav aria-label={t.disk.nav.path}>
      <ol className={styles.list}>
        {trail.map((n, i) => {
          const last = i === trail.length - 1;
          return (
            <li key={n.id} className={styles.item}>
              <button
                type="button"
                className={styles.crumb}
                aria-current={last ? 'location' : undefined}
                disabled={last}
                onClick={() => onJump(i)}
              >
                {n.name}
              </button>
              {last ? null : <span aria-hidden="true">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
