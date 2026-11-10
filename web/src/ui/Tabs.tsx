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

interface TabsByItems {
  label: string;
  items: readonly TabItem[];
  onSelect?: (id: string) => void;
  // One shape or the other, never a mix.
  value?: never;
  options?: never;
  onChange?: never;
}
/** The shape of `Segmented` (`value`, `options`, `onChange`), so a view switch moves over without a rewrite. */
interface TabsByValue<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  items?: never;
  onSelect?: never;
}

/**
 * Underline tabs: the one navigation between the views of a page (Identity 4.0; an area's modules, the tabs of
 * finance, month/week of a calendar). A `Segmented` is a filter inside a view, never the switch between views.
 * Two ways to call it: `items` (links or buttons with `active`) or the shape of `Segmented` (`value`, `options`,
 * `onChange`).
 */
export function Tabs<T extends string = string>(props: TabsByItems | TabsByValue<T>) {
  const { label } = props;
  const items: readonly TabItem[] =
    'options' in props
      ? props.options.map((o) => ({ id: o.value, label: o.label, active: o.value === props.value }))
      : props.items;
  const onSelect = (id: string) =>
    'options' in props ? props.onChange(id as T) : props.onSelect?.(id);
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
            onClick={() => onSelect(i.id)}
          >
            {i.label}
          </button>
        ),
      )}
    </nav>
  );
}
