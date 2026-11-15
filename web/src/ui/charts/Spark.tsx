import { areaPath, linePath, niceScale } from './model';
import styles from './charts.module.css';

export interface SparkProps {
  values: readonly (number | null)[];
  /** Text alternative ("Verlauf der letzten 6 Monate"); without it the curve is decoration (`aria-hidden`). */
  label?: string;
  /** `area` adds a quiet fill under the line (scale from zero). */
  variant?: 'line' | 'area';
  width?: number;
  height?: number;
}

/**
 * Mini curve for widgets and rows: no axis, no labels, the shape only. The number it belongs to stands beside it as
 * text; a single value is a dot, no value draws nothing.
 */
export function Spark({ values, label, variant = 'line', width = 96, height = 28 }: SparkProps) {
  const finite = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (finite.length === 0) return null;
  const scale = niceScale(finite, { zero: variant === 'area', count: 2 });
  // The curve fills the box: a spark shows the shape, not the round numbers of an axis.
  const box = variant === 'area' ? scale : { min: Math.min(...finite), max: Math.max(...finite) };
  if (box.min === box.max) {
    box.min -= 1;
    box.max += 1;
  }
  const pad = 2;
  return (
    <svg
      className={styles.spark}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {finite.length === 1 ? (
        <circle className={styles.sparkDot} cx={width / 2} cy={height / 2} r={2.5} />
      ) : (
        <g
          transform={`translate(${pad} ${pad}) scale(${(width - 2 * pad) / 100} ${(height - 2 * pad) / 100})`}
        >
          {variant === 'area' ? (
            <path className={styles.sparkArea} d={areaPath(values, box)} />
          ) : null}
          <path
            className={styles.sparkLine}
            d={linePath(values, box)}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
    </svg>
  );
}
