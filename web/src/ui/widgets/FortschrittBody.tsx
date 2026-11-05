import { Icon } from '../icons';
import { Progress } from '../Patterns';
import { Ring } from './Ring';
import { useWidgetSize, rowsFor } from './size';
import styles from './Widgets.module.css';
import own from './Bodies.module.css';

export interface FortschrittEntry {
  key: string;
  title: string;
  value: number;
  max: number;
  /** Right-hand text: "60 % von 400 €", "3 von 5". */
  detail: string;
  /** Set for an overrun, e.g. "27,50 € drüber": danger colour + icon + this text. */
  overText?: string;
}

/**
 * The `fortschritt` widget shape (identity v3.1, F05): one row per item as a ring (`kind="rings"`: habits,
 * drives) or a bar (`kind="bars"`: budgets, downloads), filled in the module hue; an overrun is said in words
 * and coloured danger. 2 / 4 / 6 rows by size; rings sit side by side.
 */
export function FortschrittBody({
  kind,
  entries,
}: {
  kind: 'rings' | 'bars';
  entries: readonly FortschrittEntry[];
}) {
  const size = useWidgetSize();
  const shown = entries.slice(0, rowsFor(size, [2, 4, 6]));
  const pct = (e: FortschrittEntry) => (e.max > 0 ? (100 * e.value) / e.max : 0);
  if (kind === 'rings')
    return (
      <ul className={own.rings} data-body="fortschritt" data-kind="rings">
        {shown.map((e) => (
          <li key={e.key} className={own.ringItem}>
            <Ring
              percent={Math.min(100, pct(e))}
              level={e.overText ? 'full' : 'ok'}
              size={size === 's' ? 'sm' : 'md'}
              label={e.title}
            />
            <span className={styles.rowTitle}>{e.title}</span>
            {e.overText ? (
              <span className={styles.over}>
                <Icon name="alert" size={14} />
                {e.overText}
              </span>
            ) : (
              <span className={styles.sub}>{e.detail}</span>
            )}
          </li>
        ))}
      </ul>
    );
  return (
    <ul className={styles.rows} data-body="fortschritt" data-kind="bars">
      {shown.map((e) => (
        <li key={e.key} className={styles.progressRow}>
          <div className={styles.progressHead}>
            <span className={styles.rowTitle}>{e.title}</span>
            {e.overText ? (
              <span className={styles.over}>
                <Icon name="alert" size={14} />
                {e.overText}
              </span>
            ) : (
              <span className={styles.rowAmount}>{e.detail}</span>
            )}
          </div>
          <Progress value={e.value} max={e.max} label={e.title} over={Boolean(e.overText)} />
        </li>
      ))}
    </ul>
  );
}
