import { Icon } from '../icons';
import { Progress } from '../Patterns';
import { useWidgetSize, rowsFor } from './size';
import { WidgetBody, type WidgetEmpty } from './WidgetBody';
import styles from './Widgets.module.css';

export interface ProgressEntry {
  key: string;
  title: string;
  value: number;
  max: number;
  /** Right-hand text: "60 % von 400 €", "3 von 5". */
  detail: string;
  /** Set for an overrun, e.g. "27,50 € drüber": danger colour + icon + this text. */
  overText?: string;
}

/** Progress rows with bar, percent/target and a clearly marked overrun. 2 / 4 / 6 rows. */
export function ProgressList({
  loading,
  summary,
  entries,
  ...emptyProps
}: WidgetEmpty & { loading: boolean; summary?: string; entries: ProgressEntry[] }) {
  const size = useWidgetSize();
  const shown = entries.slice(0, rowsFor(size, [2, 4, 6]));
  return (
    <WidgetBody loading={loading} isEmpty={entries.length === 0} {...emptyProps}>
      {summary ? <p className={styles.summary}>{summary}</p> : null}
      <ul className={styles.rows}>
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
    </WidgetBody>
  );
}
