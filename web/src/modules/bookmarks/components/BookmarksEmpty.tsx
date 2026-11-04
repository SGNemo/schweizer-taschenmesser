import type { ReactNode } from 'react';
import styles from './BookmarksEmpty.module.css';

/** Empty state with the module's own motif: an empty pinboard with two pins (instead of the Nemo fish). */
export function BookmarksEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty} data-testid="bookmarks-empty">
      <svg className={styles.mark} viewBox="0 0 96 64" width="96" height="64" aria-hidden="true">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="10" y="6" width="76" height="52" rx="5" />
          <rect x="20" y="18" width="24" height="28" rx="2" strokeDasharray="3 4" />
          <rect x="52" y="18" width="24" height="28" rx="2" strokeDasharray="3 4" />
          <circle cx="32" cy="14" r="2.5" />
          <circle cx="64" cy="14" r="2.5" />
        </g>
      </svg>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </div>
  );
}
