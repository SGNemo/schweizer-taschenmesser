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
 * The module row of the phone's module head (Identity 4.0, rule 3): the modules of the area as text pills in one row
 * that scrolls sideways with a fade at the edge and keeps the active entry in view. The desktop has no such row: the
 * sidebar lists the area's modules. Underline `Tabs` stay for the views inside a page.
 */
export function SubNav({
  label,
  items,
}: {
  /** Accessible name of the navigation (`t.nav.areaTabs(area)`). */
  label: string;
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
    <nav
      ref={nav}
      aria-label={label}
      className={styles.subnav}
      data-testid="subnav"
      data-module-row
      // Scrolled away from the start: the left edge fades too, so a pill cut there reads as "more" as well.
      onScroll={(e) => {
        const el = e.currentTarget;
        el.toggleAttribute('data-scrolled', el.scrollLeft > 4);
      }}
    >
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
