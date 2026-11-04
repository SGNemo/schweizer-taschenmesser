import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { motionReduced } from '@/core/shell/topbarCollapse';
import type { ModuleHue } from '@/core/modules/types';
import { Icon, type IconName } from './icons';
import styles from './SubNav.module.css';

export interface SubNavItem {
  /** Stable key (usually the route). */
  id: string;
  label: string;
  to: string;
  active: boolean;
  icon: IconName;
  /** The module's hue: the icon of the active entry and its fill take it. */
  hue?: ModuleHue;
}

/**
 * The quiet navigation under a module head: the other modules of the area as pills with their icon (identity v3).
 * On the desktop it wraps instead of cutting off; on a phone it is one row that scrolls with a fade at the edge and
 * keeps the active entry in view. Underline `Tabs` stay for the views inside a page.
 */
export function SubNav({
  label,
  eyebrow,
  items,
}: {
  /** Accessible name of the navigation (`t.nav.areaTabs(area)`). */
  label: string;
  /** Short caption in front of the pills: the area's name. */
  eyebrow?: string;
  items: readonly SubNavItem[];
}) {
  const nav = useRef<HTMLElement>(null);
  const activeId = items.find((i) => i.active)?.id;
  useEffect(() => {
    const el = nav.current;
    const pill = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !pill || el.scrollWidth <= el.clientWidth) return;
    const a = el.getBoundingClientRect();
    const b = pill.getBoundingClientRect();
    const left = Math.max(0, el.scrollLeft + b.left - a.left - (el.clientWidth - b.width) / 2);
    el.scrollTo({ left, behavior: motionReduced() ? 'auto' : 'smooth' });
  }, [activeId]);
  return (
    <nav ref={nav} aria-label={label} className={styles.subnav} data-testid="subnav">
      {eyebrow ? (
        <span className={styles.eyebrow} aria-hidden="true">
          {eyebrow}
        </span>
      ) : null}
      {items.map((i) => (
        <Link
          key={i.id}
          to={i.to}
          className={styles.pill}
          data-hue={i.hue}
          aria-current={i.active ? 'page' : undefined}
        >
          <Icon name={i.icon} size={16} />
          <span>{i.label}</span>
        </Link>
      ))}
    </nav>
  );
}
