import type { DueTone } from '@/core/time/due';
import { useWidgetSize, rowsFor } from './size';
import { StateBadge } from './StateBadge';
import { WidgetBody, type WidgetEmpty } from './WidgetBody';
import styles from './Widgets.module.css';

export interface DueEntry {
  key: string;
  title: string;
  /** State from `dueState()`: label on the right plus tone. */
  tone: DueTone;
  label: string;
  /** Optional amount shown before the state ("12,99 €"). */
  amount?: string;
}

/**
 * Due list: summary line on top ("897,89 € offen · 2 überfällig"), rows with the state on the right.
 * Overdue rows come with icon + "seit 3 Tagen" and stand out; later rows are muted. 3 / 5 / 8 rows.
 */
export function DueList({
  loading,
  summary,
  entries,
  moreLabel,
  ...emptyProps
}: WidgetEmpty & {
  loading: boolean;
  summary?: string;
  entries: DueEntry[];
  /** "+ 4 weitere" style text builder for hidden rows. */
  moreLabel?: (n: number) => string;
}) {
  const size = useWidgetSize();
  const limit = rowsFor(size, [3, 5, 8]);
  const shown = entries.slice(0, limit);
  const rest = entries.length - shown.length;
  return (
    <WidgetBody loading={loading} isEmpty={entries.length === 0} {...emptyProps}>
      {summary ? <p className={styles.summary}>{summary}</p> : null}
      <ul className={styles.rows}>
        {shown.map((e) => (
          <li key={e.key} className={styles.dueRow} data-tone={e.tone}>
            <span className={styles.rowTitle}>{e.title}</span>
            {e.amount ? <span className={styles.rowAmount}>{e.amount}</span> : null}
            <StateBadge tone={e.tone} label={e.label} />
          </li>
        ))}
      </ul>
      {rest > 0 && moreLabel ? <p className={styles.sub}>{moreLabel(rest)}</p> : null}
    </WidgetBody>
  );
}
