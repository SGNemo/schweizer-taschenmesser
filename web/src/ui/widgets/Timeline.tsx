import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { t } from '@/strings';
import { Badge } from '../Misc';
import { buildTimeline, type TimelineItem } from './timelineModel';
import { useWidgetSize, rowsFor } from './size';
import { WidgetBody, type WidgetEmpty } from './WidgetBody';
import styles from './Widgets.module.css';

export type { TimelineItem };

/**
 * "Heute" timeline: a vertical rail with times, the current time marked ("Jetzt 10:12" as text on
 * a line) and the next appointment highlighted ("Als Nächstes"). Size l also lists `tomorrow`.
 */
export function TimelineWidget({
  loading,
  today,
  tomorrow = [],
  now,
  ...emptyProps
}: WidgetEmpty & {
  loading: boolean;
  today: TimelineItem[];
  tomorrow?: TimelineItem[];
  /** Current 'HH:mm'. */
  now: string;
}) {
  const size = useWidgetSize();
  const rows = buildTimeline(today, now);
  const limit = rowsFor(size, [4, 6, 12]);
  // Keep the "now" marker and the upcoming rows when the day is long: drop finished rows first.
  const visible = trimRows(rows, limit);
  return (
    <WidgetBody
      loading={loading}
      isEmpty={today.length === 0 && (size !== 'l' || tomorrow.length === 0)}
      {...emptyProps}
    >
      <TimelineRows rows={visible} />
      {size === 'l' && tomorrow.length > 0 ? (
        <>
          <h3 className={styles.dayHead}>{t.widgets.tomorrow}</h3>
          <TimelineRows rows={buildTimeline(tomorrow, null).slice(0, 6)} />
        </>
      ) : null}
    </WidgetBody>
  );
}

function trimRows(rows: ReturnType<typeof buildTimeline>, limit: number) {
  if (rows.length <= limit) return rows;
  const nowIdx = rows.findIndex((r) => r.type === 'now');
  const start = Math.max(0, Math.min(nowIdx - 1, rows.length - limit));
  return rows.slice(start, start + limit);
}

function TimelineRows({ rows }: { rows: ReturnType<typeof buildTimeline> }) {
  return (
    <ol className={styles.timeline}>
      {rows.map((r) =>
        r.type === 'now' ? (
          <li key="now" className={styles.nowRow} aria-label={`${t.widgets.now} ${r.time}`}>
            <span className={styles.nowTime}>{t.widgets.now}</span>
            <span className={styles.nowLine} aria-hidden="true" />
          </li>
        ) : (
          <li
            key={r.item.key}
            className={styles.tlRow}
            data-next={r.next || undefined}
            data-past={r.past || undefined}
          >
            <span className={styles.tlTime}>
              {r.item.allDay || !r.item.time ? t.widgets.allDay : r.item.time}
            </span>
            <span className={styles.tlBody}>
              {r.item.to ? <Link to={r.item.to}>{r.item.title}</Link> : r.item.title}
              {r.item.kind ? <span className={styles.tlKind}>{r.item.kind}</span> : null}
              {r.next ? <Badge tone="accent">{t.widgets.next}</Badge> : null}
            </span>
          </li>
        ),
      )}
    </ol>
  );
}

/** One row of a `DatedTimeline`: a day instead of a time of day. */
export interface DatedRow {
  key: string;
  /** The formatted day ("31. Dez. 2026"). */
  when: string;
  title: ReactNode;
  /** Small tag behind the title ("Kündigen bis", "Abgelaufen"). */
  kind?: ReactNode;
  /** The day lies before today: the row is muted and stands above the marker. */
  past?: boolean;
  /** Actions of the row, at its end. */
  end?: ReactNode;
}

/**
 * The timeline of the widget catalogue over days instead of hours, for a module page: the same rail, the marker
 * ("Heute") between what has passed and what comes. Rows arrive in order; the page decides what a row says.
 */
export function DatedTimeline({
  label,
  rows,
  marker,
}: {
  label: string;
  rows: readonly DatedRow[];
  marker: string;
}) {
  const firstAhead = rows.findIndex((r) => !r.past);
  const at = firstAhead === -1 ? rows.length : firstAhead;
  const row = (r: DatedRow) => (
    <li key={r.key} className={styles.tlRow} data-past={r.past || undefined}>
      <span className={styles.tlTime}>{r.when}</span>
      <span className={styles.tlBody}>
        {r.title}
        {r.kind ? <span className={styles.tlKind}>{r.kind}</span> : null}
        {r.end ? <span className={styles.tlEnd}>{r.end}</span> : null}
      </span>
    </li>
  );
  return (
    <ol className={styles.timeline} data-dated aria-label={label}>
      {rows.slice(0, at).map(row)}
      <li className={styles.nowRow}>
        <span className={styles.nowTime}>{marker}</span>
        <span className={styles.nowLine} aria-hidden="true" />
      </li>
      {rows.slice(at).map(row)}
    </ol>
  );
}
