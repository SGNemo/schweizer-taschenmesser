import type { HTMLAttributes, ReactNode } from 'react';
import styles from './ListSurface.module.css';

interface ListSurfaceProps extends HTMLAttributes<HTMLElement> {
  /** `ul` for rows (`ItemRow` renders an `<li>`), `ol` for a ranked list, `div` when the children are no list items. */
  as?: 'ul' | 'ol' | 'div';
  /** Accessible name of the list. */
  label?: string;
  children: ReactNode;
}

/**
 * The surface rows lie on (Identity 4.0, tone steps): one raised tone without frame or shadow, and a hairline between
 * the rows, never around them. `ItemList` renders it, so the rows of a `GroupedList` group lie on one too. It is the
 * surface of a list, not a way to group one: lists by time or status still go through `GroupedList`.
 */
export function ListSurface({
  as: Tag = 'ul',
  label,
  className,
  children,
  ...rest
}: ListSurfaceProps) {
  return (
    <Tag
      {...rest}
      className={[styles.surface, className].filter(Boolean).join(' ')}
      aria-label={label}
      data-list-surface=""
    >
      {children}
    </Tag>
  );
}

/**
 * The lines inside a plan panel (planner hub 2, hand-off 00): a plain list, no hairline, lines `--space-1` apart.
 * Holds `PanelLine`s.
 */
export function PanelLines({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <ul className={styles.panelLines} aria-label={label}>
      {children}
    </ul>
  );
}

/**
 * One line inside a plan panel (planner hub 2, hand-off 00 „PanelLine“): an optional tick (`Checkbox` in a 44 px
 * target), the text, a muted meta, at most one action and the expand button (`▸`) of a member. Lighter than `ItemRow`:
 * no menu, no swipe, no hairline. The tick is the only write a line knows; its owner says what it does.
 */
export function PanelLine({
  tick,
  children,
  meta,
  action,
  expand,
  done,
}: {
  tick?: ReactNode;
  children: ReactNode;
  meta?: ReactNode;
  /** One end action (a ghost button); every other action of a panel sits in its foot. */
  action?: ReactNode;
  /** The `▸` of a pile or bundle member (packages 2, 5); after `action`. */
  expand?: ReactNode;
  /** Ticked: quieter text, the tick says it too (never colour alone). */
  done?: boolean;
}) {
  return (
    <li className={done ? `${styles.panelLine} ${styles.panelLineDone}` : styles.panelLine}>
      {tick ? <span className={styles.panelTick}>{tick}</span> : null}
      <span className={styles.panelText}>
        <span>{children}</span>
        {meta ? <span className={styles.panelMeta}>{meta}</span> : null}
      </span>
      {action}
      {expand}
    </li>
  );
}
