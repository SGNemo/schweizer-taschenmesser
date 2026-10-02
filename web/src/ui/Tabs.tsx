import { Link } from 'react-router';
import styles from './Tabs.module.css';

export interface TabItem {
  /** Stable key; also the id passed to `onSelect`. */
  id: string;
  label: string;
  active: boolean;
  /** Route to navigate to (renders a link); without it the tab calls `onSelect`. */
  to?: string;
}

/**
 * Underline tabs for the sub-views of a page (an area's modules, finance tabs). Filters inside
 * a list use `Segmented` instead.
 */
export function Tabs({
  label,
  items,
  onSelect,
}: {
  label: string;
  items: readonly TabItem[];
  onSelect?: (id: string) => void;
}) {
  return (
    <nav aria-label={label} className={styles.tabs}>
      {items.map((i) =>
        i.to ? (
          <Link
            key={i.id}
            to={i.to}
            className={styles.tab}
            aria-current={i.active ? 'page' : undefined}
          >
            {i.label}
          </Link>
        ) : (
          <button
            key={i.id}
            type="button"
            className={styles.tab}
            aria-current={i.active ? 'page' : undefined}
            onClick={() => onSelect?.(i.id)}
          >
            {i.label}
          </button>
        ),
      )}
    </nav>
  );
}
