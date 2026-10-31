import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { motionReduced } from '@/core/shell/topbarCollapse';
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
  const nav = useRef<HTMLElement>(null);
  const activeId = items.find((i) => i.active)?.id;
  // A row that scrolls sideways (phone) keeps the active tab in view; no animation with less motion.
  useEffect(() => {
    const el = nav.current;
    const tab = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !tab || el.scrollWidth <= el.clientWidth) return;
    const a = el.getBoundingClientRect();
    const b = tab.getBoundingClientRect();
    const left = Math.max(0, el.scrollLeft + b.left - a.left - (el.clientWidth - b.width) / 2);
    el.scrollTo({ left, behavior: motionReduced() ? 'auto' : 'smooth' });
  }, [activeId]);
  return (
    <nav ref={nav} aria-label={label} className={styles.tabs}>
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
