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
      <span className={`${styles.time} ${compact ? styles.timeCompact : ''}`}>
        {time ?? (compact ? '' : t.calendar.allDay)}
      </span>
      <span className={`${styles.kind} ${styles[`kind_${item.kind}`] ?? ''}`}>
        {kindLabel(item.kind)}
      </span>
      <span className={`${styles.itemTitle} ${item.done ? styles.done : ''}`}>{item.title}</span>
    </>
  );
  return (
    <li>
      {onOpen ? (
        <button type="button" className={styles.itemRow} onClick={() => onOpen(item)}>
          {content}
        </button>
      ) : (
        <div className={styles.itemRow}>{content}</div>
      )}
    </li>
  );
}
