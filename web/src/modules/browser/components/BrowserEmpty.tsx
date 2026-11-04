import type { ReactNode } from 'react';
import styles from './BrowserEmpty.module.css';

/** Empty state with the module's own motif: an empty address bar with a blinking-free cursor line (instead of the Nemo fish). */
export function BrowserEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty} data-testid="browser-empty">
      <svg className={styles.mark} viewBox="0 0 96 64" width="96" height="64" aria-hidden="true">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="8" y="22" width="80" height="20" rx="10" />
          <circle cx="22" cy="32" r="3" />
          <path d="M32 32h30" strokeDasharray="3 4" />
        </g>
      </svg>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </div>
  );
}
