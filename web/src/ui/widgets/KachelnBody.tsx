import { Link } from 'react-router';
import { useWidgetSize, rowsFor } from './size';
import styles from './Bodies.module.css';

export interface Kachel {
  key: string;
  /** The figure on the tile ("12"). */
  value: string;
  /** What the figure counts ("Abgelaufen"). */
  label: string;
  /** State line under the label ("2 diese Woche"); `tone` only for an overrun/expiry. */
  state?: string;
  tone?: 'danger' | 'warning';
  /** Where the tile leads (a filter of the module page). */
  to?: string;
}

/**
 * The `kacheln` widget shape (identity v3.1, F05): 2 × 2 tiles, each a figure with its label and a state line.
 * Colour only with meaning and never alone: an overrun says so in words. 4 / 4 / 6 tiles by size.
 */
export function KachelnBody({ tiles }: { tiles: readonly Kachel[] }) {
  const size = useWidgetSize();
  const shown = tiles.slice(0, rowsFor(size, [4, 4, 6]));
  return (
    <ul className={styles.kacheln} data-body="kacheln">
      {shown.map((k) => {
        const inner = (
          <>
            <span className={styles.kachelValue}>{k.value}</span>
            <span className={styles.kachelLabel}>{k.label}</span>
            {k.state ? (
              <span className={styles.kachelState} data-tone={k.tone}>
                {k.state}
              </span>
            ) : null}
          </>
        );
        return (
          <li key={k.key} className={styles.kachel} data-tone={k.tone}>
            {k.to ? (
              <Link to={k.to} className={styles.kachelLink}>
                {inner}
              </Link>
            ) : (
              <span className={styles.kachelLink}>{inner}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
