import type { CalendarItem } from '@/core/modules/types';
import { formatDay, today } from '@/core/time/dates';
import { dueTone } from '@/core/time/due';
import { t } from '@/strings';
import type { CSSProperties } from 'react';
import { sourceHue } from './sourceHue';
import styles from '../routes/calendar.module.css';

interface Props {
  item: CalendarItem;
  onOpen?: (item: CalendarItem) => void;
  compact?: boolean;
  /** Name of the person the entry is for ("für Lena"), resolved by the page. */
  person?: string;
}

export function kindLabel(kind: string): string {
  return t.calendar.kinds[kind] ?? kind;
}

/** Kinds that are deadlines: only these turn red, and only once they are overdue (DESIGN-SPEC §4a). */
const DEADLINES = new Set(['invoice', 'cancel', 'end', 'expiry']);

/** An open deadline whose day has passed. */
export function isOverdue(item: CalendarItem, day: string = today()): boolean {
  return DEADLINES.has(item.kind) && dueTone(item.date, !!item.done, day) === 'overdue';
}

/** The CSS class of the kind badge: `kind_overdue` for an overdue deadline, otherwise `kind_<kind>`. */
export function kindClass(item: CalendarItem, day?: string): string {
  return isOverdue(item, day) ? 'kind_overdue' : `kind_${item.kind}`;
}

/** "09:00–10:30", "21:30 → Mo 06:30" (ends on a later day), "bis 06:30" (second day of a night shift). */
function timeLabel(item: CalendarItem): string | null {
  if (item.allDay) return item.continued && item.endTime ? t.calendar.endsAt(item.endTime) : null;
  const start = item.time ?? '';
  if (item.endDate && item.endDate > item.date) {
    return `${start} → ${formatDay(item.endDate, 'EEE')}${item.endTime ? ` ${item.endTime}` : ''}`;
  }
  return `${start}${item.endTime ? `–${item.endTime}` : ''}`;
}

/** One calendar entry: time (or "ganztägig"), kind badge and title. */
export function ItemRow({ item, onOpen, compact, person }: Props) {
  const time = timeLabel(item);
  const overdue = isOverdue(item);
  const content = (
    <>
      <span className={styles.time}>{time ?? (compact ? '' : t.calendar.allDay)}</span>
      <span
        className={`${styles.kind} ${styles[kindClass(item)] ?? ''}`}
        data-hue={sourceHue(item)}
      >
        {overdue ? `${kindLabel(item.kind)} · ${t.meanings.overdue}` : kindLabel(item.kind)}
      </span>
      <span className={`${styles.itemTitle} ${item.done ? styles.done : ''}`} title={item.title}>
        {item.color ? (
          <span className={styles.colorDot} style={{ background: item.color }} aria-hidden="true" />
        ) : null}
        {item.title}
        {person ? <span className={styles.person}>{` · ${t.assign.forName(person)}`}</span> : null}
      </span>
    </>
  );
  const rowClass = `${styles.itemRow} ${compact ? styles.itemRowCompact : ''}`;
  const capsule = (item.color ? { '--cal': item.color } : undefined) as CSSProperties | undefined;
  return (
    <li>
      {onOpen ? (
        <button type="button" className={rowClass} style={capsule} onClick={() => onOpen(item)}>
          {content}
        </button>
      ) : (
        <div className={rowClass} style={capsule}>
          {content}
        </div>
      )}
    </li>
  );
}
