import type { ReactNode } from 'react';
import styles from './FeedsEmpty.module.css';

/** Empty state with the module's own motif: a folded newspaper with a masthead and columns (instead of the Nemo fish). */
export function FeedsEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty} data-testid="feeds-empty">
      <svg className={styles.mark} viewBox="0 0 96 64" width="96" height="64" aria-hidden="true">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 54h64a6 6 0 0 0 6-6V12H30v36a6 6 0 0 1-6 6" />
          <path d="M30 12H10v36a6 6 0 0 0 6 6" />
          <path d="M38 20h40M38 22.5h40" />
          <path d="M38 32h16M38 40h16M60 32h18M60 40h18M60 48h18" strokeDasharray="2 4" />
        </g>
      </svg>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </div>
  );
}
