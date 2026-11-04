import type { ReactNode } from 'react';
import { EmptyState } from '@/ui';

/** Empty state with the module's own motif: a record half out of its sleeve, in outline (instead of the Nemo fish). */
export function MusicEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <EmptyState
      title={title}
      motif={
        <svg viewBox="0 0 96 64" width="96" height="64" aria-hidden="true">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="10" y="8" width="46" height="48" rx="3" />
            <circle cx="62" cy="32" r="22" />
            <circle cx="62" cy="32" r="7" />
            <circle cx="62" cy="32" r="1.5" />
          </g>
        </svg>
      }
    >
      {children}
    </EmptyState>
  );
}
