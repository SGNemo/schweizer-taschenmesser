import { Link } from 'react-router';
import styles from './Patterns.module.css';

export interface WidgetEntry {
  key: string;
  title: string;
  meta?: string;
  overdue?: boolean;
}

/** Standard dashboard widget body: optional headline, a few entries and a link to the module. */
export function WidgetList({
  loading,
  empty,
  headline,
  entries,
  to,
  linkLabel,
}: {
  loading: boolean;
  empty?: string;
  headline?: string;
  entries: WidgetEntry[];
  to: string;
  linkLabel: string;
}) {
  if (loading) return <p role="status">…</p>;
  if (entries.length === 0 && empty) return <p className={styles.muted}>{empty}</p>;
  return (
    <div>
      {headline ? <p className={styles.statValue}>{headline}</p> : null}
      <ul className={styles.list} style={{ gap: 'var(--space-1)', margin: 'var(--space-2) 0' }}>
        {entries.map((e) => (
          <li
            key={e.key}
            style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}
          >
            <span className={styles.title} style={{ fontWeight: 500 }}>
              {e.title}
            </span>
            {e.meta ? (
              <span className={e.overdue ? styles.overdue : styles.muted}>{e.meta}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <Link to={to}>{linkLabel}</Link>
    </div>
  );
}
