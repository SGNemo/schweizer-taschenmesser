import type { ReactNode } from 'react';
import styles from './NotesEmpty.module.css';

/** Empty state with the module's own motif: a blank sheet with a folded corner and a margin line (instead of the Nemo fish). */
export function NotesEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty} data-testid="notes-empty">
      <svg className={styles.mark} viewBox="0 0 96 64" width="96" height="64" aria-hidden="true">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M30 6h28l10 10v42H30z" />
          <path d="M58 6v10h10" />
          <path d="M38 6v52" strokeDasharray="2 4" />
          <path d="M44 28h18M44 38h18M44 48h10" strokeDasharray="2 4" />
        </g>
      </svg>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </div>
  );
}
