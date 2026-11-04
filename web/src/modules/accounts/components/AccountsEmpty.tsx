import type { ReactNode } from 'react';
import { EmptyState } from '@/ui';

/** Empty state with the module's own motif: a closed vault door in outline (instead of the Nemo fish). Shows no content. */
export function AccountsEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <EmptyState
      title={title}
      testId="accounts-empty"
      motif={
        <svg viewBox="0 0 96 64" width="96" height="64" aria-hidden="true">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="30" y="6" width="36" height="52" rx="3" />
            <circle cx="48" cy="32" r="9" />
            <path d="M48 26v12M42 32h12" />
          </g>
        </svg>
      }
    >
      {children}
    </EmptyState>
  );
}
