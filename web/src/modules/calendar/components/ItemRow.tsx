import type { CalendarItem } from '@/core/modules/types';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import styles from '../routes/calendar.module.css';

interface Props {
  item: CalendarItem;
  onOpen?: (item: CalendarItem) => void;
  compact?: boolean;
}

export function kindLabel(kind: string): string {
  return t.calendar.kinds[kind] ?? kind;
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
export function ItemRow({ item, onOpen, compact }: Props) {
  const time = timeLabel(item);
  const content = (
    <>
      <span className={styles.time}>{time ?? (compact ? '' : t.calendar.allDay)}</span>
      <span className={`${styles.kind} ${styles[`kind_${item.kind}`] ?? ''}`}>
        {kindLabel(item.kind)}
      </span>
      <span className={`${styles.itemTitle} ${item.done ? styles.done : ''}`} title={item.title}>
        {item.color ? (
          <span className={styles.colorDot} style={{ background: item.color }} aria-hidden="true" />
        ) : null}
        {item.title}
      </span>
    </>
  );
  const rowClass = `${styles.itemRow} ${compact ? styles.itemRowCompact : ''}`;
  return (
    <li>
      {onOpen ? (
        <button type="button" className={rowClass} onClick={() => onOpen(item)}>
          {content}
        </button>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
    </li>
  );
}
