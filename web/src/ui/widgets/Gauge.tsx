import { Progress } from '../Patterns';
import { Ring, type RingLevel } from './Ring';
import { useWidgetSize } from './size';
import { WidgetBody, type WidgetEmpty } from './WidgetBody';
import styles from './Widgets.module.css';

export interface GaugeEntry {
  key: string;
  name: string;
  percent: number;
  level: RingLevel;
  /** "123 GB frei von 476 GB" */
  detail: string;
  /** Plain-language hint, e.g. "Fast voll – Aufräumen empfohlen" (shown with the warning icon-less text). */
  hint?: string;
}

/** Fill-level widget: a bar per drive, coloured by `level` and always with the percentage as text. */
export function GaugeList({
  loading,
  entries,
  ...emptyProps
}: WidgetEmpty & { loading: boolean; entries: GaugeEntry[] }) {
  const size = useWidgetSize();
  return (
    <WidgetBody loading={loading} isEmpty={entries.length === 0} {...emptyProps}>
      <ul className={styles.rows}>
        {entries.map((e) =>
          size === 's' ? (
            <li key={e.key} className={styles.gaugeRing}>
              <Ring percent={e.percent} level={e.level} size="sm" label={e.name} />
              <span className={styles.rowTitle}>{e.name}</span>
            </li>
          ) : (
            <li key={e.key} className={styles.progressRow} data-level={e.level}>
              <div className={styles.progressHead}>
                <span className={styles.rowTitle}>{e.name}</span>
                <span className={styles.rowAmount}>{e.percent} %</span>
              </div>
              <Progress
                value={e.percent}
                max={100}
                label={e.name}
                tone={e.level === 'ok' ? undefined : e.level === 'tight' ? 'warning' : 'danger'}
              />
              <p className={styles.sub}>{e.detail}</p>
              {size === 'l' && e.hint ? <p className={styles.hintLine}>{e.hint}</p> : null}
            </li>
          ),
        )}
      </ul>
    </WidgetBody>
  );
}
