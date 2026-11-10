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
      className={[styles.surface, className].filter(Boolean).join(' ')}
      aria-label={label}
      data-list-surface=""
      {...rest}
    >
      {children}
    </Tag>
  );
}
