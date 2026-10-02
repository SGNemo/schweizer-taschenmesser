import { Link } from 'react-router';
import { EmptyState, Skeleton } from './Misc';
import styles from './Patterns.module.css';

export interface WidgetEntry {
  key: string;
  title: string;
  meta?: string;
  overdue?: boolean;
}

/**
 * Standard dashboard widget body: optional headline (+ subline), a few entries and a link to the
 * module. Loading shows skeleton lines, an empty module the compact empty state.
 */
export function WidgetList({
  loading,
  empty,
  headline,
  subline,
  entries,
  to,
  linkLabel,
  emptyAction,
}: {
  loading: boolean;
  empty?: string;
  headline?: string;
  subline?: string;
  entries: WidgetEntry[];
  to: string;
  /** Label of the module link of the empty state (the home header links to the module itself). */
  linkLabel: string;
  /**
   * Primary action of the empty state (e.g. "Termin anlegen" → `/calendar?new=1`). Without one the
   * empty state links to the module, so an empty widget always offers a next step.
   */
  emptyAction?: { label: string; to: string };
}) {
  if (loading)
    return (
      <div className={styles.widgetSkeleton} role="status" aria-label="…">
        <Skeleton width="60%" height="1.25rem" />
        <Skeleton width="85%" />
        <Skeleton width="70%" />
      </div>
    );
  if (entries.length === 0 && empty) {
    const action = emptyAction ?? { label: linkLabel, to };
    return (
      <EmptyState compact title={empty}>
        <Link to={action.to}>{action.label}</Link>
      </EmptyState>
    );
  }
  return (
    <div>
      {headline ? <p className={styles.statValue}>{headline}</p> : null}
      {subline ? <p className={styles.widgetSub}>{subline}</p> : null}
      <ul className={styles.widgetList}>
        {entries.map((e) => (
          <li key={e.key} className={styles.widgetItem}>
            <span className={styles.widgetItemTitle}>{e.title}</span>
            {e.meta ? (
              <span className={e.overdue ? styles.overdue : styles.widgetMeta}>{e.meta}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
