import type { ReactNode } from 'react';
import { EmptyState } from '@/ui';

/** Empty state with the module's own motif: an empty folder with its tab (instead of the Nemo fish). */
export function VaultEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <EmptyState
      title={title}
      testId="vault-empty"
      motif={
        <svg viewBox="0 0 96 64" width="96" height="64" aria-hidden="true">
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
      }
    >
      {children}
    </EmptyState>
  );
}
