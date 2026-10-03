import type { CalendarItem } from '@/core/modules/types';
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

/** One calendar entry: time (or "ganztägig"), kind badge and title. */
export function ItemRow({ item, onOpen, compact }: Props) {
  const time = item.allDay ? null : `${item.time ?? ''}${item.endTime ? `–${item.endTime}` : ''}`;
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
