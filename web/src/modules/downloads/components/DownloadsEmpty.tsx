import type { ReactNode } from 'react';
import styles from './DownloadsEmpty.module.css';

/** Empty state with the module's own motif: an arrow dropping into a tray (instead of the Nemo fish). */
export function DownloadsEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty} data-testid="downloads-empty">
      <svg className={styles.mark} viewBox="0 0 96 64" width="96" height="64" aria-hidden="true">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M48 8v30M36 28l12 12 12-12" />
          <path d="M16 40v12a4 4 0 0 0 4 4h56a4 4 0 0 0 4-4V40" />
          <path d="M16 46h20l4 6h16l4-6h20" />
        </g>
      </svg>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </div>
  );
}
