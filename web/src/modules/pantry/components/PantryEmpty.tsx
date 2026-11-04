import type { ReactNode } from 'react';
import { EmptyState } from '@/ui';

/** Empty state with the module's own motif: an empty shelf with three outline jars (instead of the Nemo fish). */
export function PantryEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <EmptyState
      title={title}
      testId="pantry-empty"
      motif={
        <svg viewBox="0 0 96 64" width="96" height="64" aria-hidden="true">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 58h84" />
            <rect x="14" y="28" width="18" height="30" rx="4" />
            <path d="M18 28v-5h10v5" />
            <rect x="39" y="20" width="18" height="38" rx="4" />
            <path d="M43 20v-5h10v5" />
            <rect x="64" y="32" width="18" height="26" rx="4" />
            <path d="M68 32v-5h10v5" />
          </g>
        </svg>
      }
    >
      {children}
    </EmptyState>
  );
}
