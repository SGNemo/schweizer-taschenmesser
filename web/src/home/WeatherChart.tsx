import { useEffect, useRef, useState } from 'react';
import { dateTimeFormat } from '@/core/i18n/format';
import type { HourRow } from '@/core/weather/api';
import { rateHour, type Rating } from '@/core/weather/logic';
import { tWeather } from '@/strings.weather';
import styles from './WeatherChart.module.css';

const HEIGHT = 232;
const PAD = { left: 34, right: 14, top: 22 };
const TEMP_H = 112;
const RAIN_TOP = PAD.top + TEMP_H + 16;
const RAIN_H = 34;
const STRIP_Y = RAIN_TOP + RAIN_H + 8;
const STRIP_H = 8;
const LABEL_Y = STRIP_Y + STRIP_H + 16;

export const RATING_COLOR: Record<Rating, string> = {
  good: 'var(--success)',
  fair: 'var(--text-3)',
  poor: 'var(--warning)',
};

/** Width of the element, kept up to date; a fixed guess where there is no ResizeObserver (tests). */
function useWidth<T extends Element>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** A smooth line through the points: horizontal tangents at every point, so it never overshoots. */
function smoothPath(pts: readonly [number, number][]): string {
  if (pts.length === 0) return '';
  let d = `M${pts[0]![0].toFixed(1)},${pts[0]![1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    const mx = ((x0 + x1) / 2).toFixed(1);
    d += `C${mx},${y0.toFixed(1)} ${mx},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

/**
 * The next hours as one picture: the temperature as a line (day and night shaded), the chance of rain
 * as bars underneath and one small strip with the rating of every hour. Drawn by hand in SVG; the
 * text rows below the picture carry every number, so the picture itself is `role="img"`.
 */
export function WeatherChart({ hours }: { hours: readonly HourRow[] }) {
  const tx = tWeather.use();
  const [ref, width] = useWidth<HTMLDivElement>();
  if (hours.length < 2) return null;

  const hourFmt = dateTimeFormat({ hour: '2-digit' });
  const temps = hours.map((h) => h.temp);
  const lo = Math.floor(Math.min(...temps) - 1);
  const hi = Math.ceil(Math.max(...temps) + 1);
  const innerW = Math.max(120, width - PAD.left - PAD.right);
  const step = innerW / (hours.length - 1);
  const x = (i: number) => PAD.left + i * step;
  const y = (t: number) => PAD.top + TEMP_H - ((t - lo) / (hi - lo || 1)) * TEMP_H;
  const pts = hours.map((h, i): [number, number] => [x(i), y(h.temp)]);
  const line = smoothPath(pts);
  const area = `${line}L${x(hours.length - 1).toFixed(1)},${PAD.top + TEMP_H}L${PAD.left},${PAD.top + TEMP_H}Z`;
  const minI = temps.indexOf(Math.min(...temps));
  const maxI = temps.indexOf(Math.max(...temps));
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const labelEvery = width < 480 ? 6 : 3;
  const barW = Math.max(3, Math.min(14, step * 0.6));
  const hourOf = (h: HourRow) => Number(h.time.slice(11, 13));
  const dateOf = (h: HourRow) =>
    new Date(
      Number(h.time.slice(0, 4)),
      Number(h.time.slice(5, 7)) - 1,
      Number(h.time.slice(8, 10)),
      hourOf(h),
    );

  // The first value is labelled unless an extreme sits right next to it.
  const marks = [...new Set([...(Math.min(minI, maxI) > 2 ? [0] : []), minI, maxI])];
  return (
    <div ref={ref} className={styles.chart} data-testid="weather-chart">
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={tx.chartLabel(Math.min(...temps), Math.max(...temps))}
      >
        {hours.map((h, i) =>
          h.night ? (
            <rect
              key={`n${h.time}`}
              className={styles.night}
              x={x(i) - step / 2 < PAD.left ? PAD.left : x(i) - step / 2}
              y={PAD.top}
              width={i === 0 || i === hours.length - 1 ? step / 2 : step}
              height={TEMP_H}
            />
          ) : null,
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line
              className={styles.grid}
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(t)}
              y2={y(t)}
            />
            <text className={styles.axis} x={PAD.left - 6} y={y(t) + 4} textAnchor="end">
              {tx.temp(t)}
            </text>
          </g>
        ))}
        <path className={styles.area} d={area} />
        <path className={styles.line} d={line} />
        {marks.map((i) => (
          <g key={`m${i}`}>
            <circle className={styles.dot} cx={x(i)} cy={y(hours[i]!.temp)} r={4} />
            <text
              className={styles.value}
              x={Math.min(Math.max(x(i), PAD.left + 8), width - PAD.right - 8)}
              y={y(hours[i]!.temp) + (i === maxI && i !== 0 ? -9 : i === minI ? 17 : -9)}
              textAnchor="middle"
            >
              {tx.temp(hours[i]!.temp)}
            </text>
          </g>
        ))}
        {hours.map((h, i) => (
          <g key={`r${h.time}`}>
            <rect
              className={styles.rain}
              x={x(i) - barW / 2}
              y={RAIN_TOP + RAIN_H - (Math.min(100, h.rain) / 100) * RAIN_H}
              width={barW}
              height={(Math.min(100, h.rain) / 100) * RAIN_H}
              rx={1.5}
            />
            <rect
              x={x(i) - step / 2 + 0.5}
              y={STRIP_Y}
              width={Math.max(1, step - 1)}
              height={STRIP_H}
              rx={2}
              fill={RATING_COLOR[rateHour(h)]}
              opacity={0.85}
            />
            {i % labelEvery === 0 ? (
              <text className={styles.axis} x={x(i)} y={LABEL_Y} textAnchor="middle">
                {hourFmt.format(dateOf(h))}
              </text>
            ) : null}
          </g>
        ))}
        <text className={styles.axis} x={PAD.left - 6} y={RAIN_TOP + 9} textAnchor="end">
          100%
        </text>
        <text className={styles.axis} x={PAD.left - 6} y={RAIN_TOP + RAIN_H} textAnchor="end">
          0
        </text>
      </svg>
      <ul className={styles.legend}>
        <li>
          <span className={`${styles.swatch} ${styles.swatchLine}`} aria-hidden="true" />
          {tx.legendTemp}
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.swatchRain}`} aria-hidden="true" />
          {tx.legendRain}
        </li>
        {(['good', 'fair', 'poor'] as const).map((r) => (
          <li key={r}>
            <span
              className={styles.swatch}
              style={{ background: RATING_COLOR[r] }}
              aria-hidden="true"
            />
            {tx.ratings[r]}
          </li>
        ))}
      </ul>
    </div>
  );
}
