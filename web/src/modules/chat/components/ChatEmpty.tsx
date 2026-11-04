import type { ReactNode } from 'react';
import { EmptyState } from '@/ui';

/** Empty state with the module's own motif: two empty speech bubbles in outline (instead of the Nemo fish). */
export function ChatEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <EmptyState
      title={title}
      testId="chat-empty"
      motif={
        <svg viewBox="0 0 96 64" width="96" height="64" aria-hidden="true">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 10h40a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H26l-8 7v-7h-4a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6z" />
            <path
              d="M42 40h34a6 6 0 0 1 6 6v6a6 6 0 0 1-6 6h-2v6l-8-6H42a6 6 0 0 1-6-6v-6a6 6 0 0 1 6-6z"
              strokeDasharray="3 4"
            />
          </g>
        </svg>
      }
    >
      {children}
    </EmptyState>
  );
}
