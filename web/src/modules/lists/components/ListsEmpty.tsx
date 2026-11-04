import type { ReactNode } from 'react';
import { EmptyState } from '@/ui';

/** Empty state with the module's own motif: an empty receipt roll for the shopping list, an open case for the rest. */
export function ListsEmpty({
  title,
  kind,
  children,
}: {
  title: string;
  kind: 'shopping' | 'packing' | 'checklist';
  children?: ReactNode;
}) {
  return (
    <EmptyState
      title={title}
      testId="lists-empty"
      motif={
        <svg viewBox="0 0 96 64" width="96" height="64" aria-hidden="true">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {kind === 'packing' ? (
              <>
                <rect x="16" y="22" width="64" height="36" rx="5" />
                <path d="M38 22v-6a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v6" />
                <path d="M16 38h64" />
              </>
            ) : (
              <>
                <path d="M28 6h40v50l-5-4-5 4-5-4-5 4-5-4-5 4-5-4-5 4z" />
                <path d="M36 20h24M36 30h24M36 40h14" strokeDasharray="2 4" />
              </>
            )}
          </g>
        </svg>
      }
    >
      {children}
    </EmptyState>
  );
}
