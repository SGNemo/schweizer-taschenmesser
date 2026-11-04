import type { ReactNode } from 'react';
import styles from './MailEmpty.module.css';

/** Empty state with the module's own motif: a closed envelope in outline (instead of the Nemo fish). */
export function MailEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty} data-testid="mail-empty">
      <svg className={styles.mark} viewBox="0 0 96 64" width="96" height="64" aria-hidden="true">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="10" y="12" width="76" height="44" rx="5" />
          <path d="M12 16 48 40 84 16" />
          <path d="M20 50h16M60 50h16" strokeDasharray="2 4" />
        </g>
      </svg>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </div>
  );
}
