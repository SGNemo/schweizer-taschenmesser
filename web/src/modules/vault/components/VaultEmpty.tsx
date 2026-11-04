import type { ReactNode } from 'react';
import styles from './VaultEmpty.module.css';

/** Empty state with the module's own motif: an empty folder with its tab (instead of the Nemo fish). */
export function VaultEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty} data-testid="vault-empty">
      <svg className={styles.mark} viewBox="0 0 96 64" width="96" height="64" aria-hidden="true">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 54V14a4 4 0 0 1 4-4h20l6 8h42a4 4 0 0 1 4 4v32a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" />
          <path d="M10 26h76" />
        </g>
      </svg>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </div>
  );
}
