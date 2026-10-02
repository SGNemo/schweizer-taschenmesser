import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { EmptyState, Skeleton } from '../Misc';
import styles from './Widgets.module.css';

export interface WidgetEmpty {
  /** Text of the empty state; without it an empty widget renders its (empty) children. */
  empty?: string;
  /** Next step offered by the empty state, e.g. "Termin anlegen" → `/calendar?new=1`. */
  emptyAction?: { label: string; to: string };
}

/** Shared loading and empty state of all widget types. */
export function WidgetBody({
  loading,
  isEmpty,
  empty,
  emptyAction,
  children,
}: WidgetEmpty & { loading: boolean; isEmpty: boolean; children: ReactNode }) {
  if (loading)
    return (
      <div className={styles.skeleton} role="status" aria-label="…">
        <Skeleton width="60%" height="1.25rem" />
        <Skeleton width="85%" />
        <Skeleton width="70%" />
      </div>
    );
  if (isEmpty && empty)
    return (
      <EmptyState compact title={empty}>
        {emptyAction ? <Link to={emptyAction.to}>{emptyAction.label}</Link> : null}
      </EmptyState>
    );
  return <>{children}</>;
}
