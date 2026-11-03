import type { CSSProperties } from 'react';
import styles from './Sky.module.css';

export type SkyKind = 'clear' | 'cloudy' | 'rain' | 'night';

/**
 * Gradient sky by condition and daytime (weather head and widget). Pure decoration (`aria-hidden`); the text on it
 * is always `--text` (night sets its own light ink). `compact` = the small round swatch for the "Ruhig" widget.
 * Condition groups come from `core/weather/logic` (`group`); `night` wins over the group.
 */
export function skyKind(group: string | undefined, isNight: boolean): SkyKind {
  if (isNight) return 'night';
  switch (group) {
    case 'drizzle':
    case 'rain':
    case 'showers':
    case 'snow':
    case 'thunder':
      return 'rain';
    case 'cloudy':
    case 'fog':
    case 'partly':
      return 'cloudy';
    default:
      return 'clear';
  }
}

export function Sky({
  kind,
  compact = false,
  style,
}: {
  kind: SkyKind;
  compact?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className={compact ? `${styles.sky} ${styles.compact}` : styles.sky}
      data-sky={kind}
      style={style}
      aria-hidden="true"
      data-testid="sky"
    >
      {kind === 'clear' || kind === 'cloudy' ? <span className={styles.sun} /> : null}
      {kind === 'night' ? <span className={styles.moon} /> : null}
      {kind !== 'clear' ? <span className={styles.cloud} /> : null}
      <span className={styles.horizon} />
    </div>
  );
}
