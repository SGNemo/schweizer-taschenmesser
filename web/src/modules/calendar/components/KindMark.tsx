import type { CSSProperties } from 'react';
import type { CalendarItem } from '@/core/modules/types';
import { sourceHue } from './sourceHue';
import styles from '../routes/calendar.module.css';

/** The quiet kind mark of an entry (the kind itself is in the tooltip and the day's list); month and week share it. */
export function KindMark({ item }: { item: CalendarItem }) {
  return (
    <span
      className={styles.lineMark}
      data-kind={item.kind}
      data-hue={sourceHue(item)}
      style={item.color ? ({ '--cal': item.color } as CSSProperties) : undefined}
      aria-hidden="true"
    />
  );
}
