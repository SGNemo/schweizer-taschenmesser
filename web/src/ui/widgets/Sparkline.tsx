import styles from './Widgets.module.css';

/**
 * Tiny line chart of a few values: inline SVG, no library. Decorative for screen readers; `label`
 * gives the text alternative (e.g. "Verlauf der letzten 6 Monate"). At least two values are needed.
 */
export function Sparkline({
  values,
  label,
  width = 96,
  height = 28,
}: {
  values: readonly number[];
  label?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - 2 * pad);
      const y = height - pad - ((v - min) / span) * (height - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      className={styles.sparkline}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <polyline points={points} fill="none" />
    </svg>
  );
}
