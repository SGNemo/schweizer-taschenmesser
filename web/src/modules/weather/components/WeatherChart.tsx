import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { dateTimeFormat } from '@/core/i18n/format';
import type { Air } from '@/core/weather/air';
import type { HourRow } from '@/core/weather/api';
import { tWeather } from '@/strings.weather';
import { tWeatherPage } from '@/strings.weatherPage';
import { SelectField } from '@/ui';
import {
  CHART_OPTIONS,
  isChartOption,
  readChartChoice,
  seriesOf,
  writeChartChoice,
  type ChartOption,
  type Series,
  type Values,
} from '../chartSeries';
import styles from './WeatherChart.module.css';

/** The two bands of the mockup (`page.js` `drawChart`): lines on top, bars and arrows under them. */
const L = 40;
const R = 8;
const T0 = 12;
const T1 = 172;
const B0 = 192;
const B1 = 236;
const LY = 258;
const H = 266;

/**
 * Width of the element, kept up to date; a fixed guess where there is no ResizeObserver (tests). A
 * callback ref, so the observer also attaches when the element appears only later (the chart renders
 * nothing while fewer than two hours are known and fills up after the next fetch).
 */
function useWidth<T extends Element>(): [(el: T | null) => void, number] {
  const [width, setWidth] = useState(640);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    observer.current = ro;
  }, []);
  useEffect(() => () => observer.current?.disconnect(), []);
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

/** Runs of consecutive values (a line stops where the data stops, e.g. air after five days). */
function runs(v: Values, x: (i: number) => number, y: (n: number) => number): string[] {
  const out: string[] = [];
  let pts: [number, number][] = [];
  v.forEach((n, i) => {
    if (n == null) {
      if (pts.length > 1) out.push(smoothPath(pts));
      pts = [];
    } else pts.push([x(i), y(n)]);
  });
  if (pts.length > 1) out.push(smoothPath(pts));
  return out;
}

const LEGEND: Record<
  ChartOption,
  (
    | 'temp'
    | 'feels'
    | 'amount'
    | 'chance'
    | 'wind'
    | 'gusts'
    | 'sunshine'
    | 'cloud'
    | 'pressure'
    | 'uv'
    | 'aqi'
  )[]
> = {
  tempRain: ['temp', 'feels', 'amount', 'chance'],
  wind: ['wind', 'gusts'],
  sun: ['sunshine', 'cloud'],
  pressure: ['pressure'],
  uv: ['uv'],
  air: ['aqi'],
};
const SWATCH: Record<string, string | undefined> = {
  feels: styles.swDash,
  gusts: styles.swDash,
  amount: styles.swBox,
  chance: styles.swThin,
  sunshine: styles.swSun,
  uv: styles.swSun,
};

function Plot({
  s,
  hours,
  width,
  marker,
}: {
  s: Series;
  hours: readonly HourRow[];
  width: number;
  marker?: string;
}) {
  const tx = tWeather.use();
  const hourFmt = dateTimeFormat({ hour: '2-digit' });
  const n = hours.length;
  const slot = (width - L - R) / n;
  const X = (i: number) => L + (i + 0.5) * slot;
  const vals = [...(s.line ?? []), ...(s.line2 ?? [])].filter((v): v is number => v != null);
  const lo = s.top?.lo ?? Math.floor(Math.min(...vals)) - 1;
  const hi = s.top?.hi ?? Math.ceil(Math.max(...vals)) + 1;
  const Y = (v: number) => T1 - ((v - lo) / (hi - lo || 1)) * (T1 - T0);
  const temp = s.option === 'tempRain';
  const ticks = temp
    ? [lo, hi, lo < 0 && hi > 0 ? 0 : Math.round((lo + hi) / 2)]
    : [lo, Math.round((lo + hi) / 2), hi];
  const label = (v: number) => (temp ? tx.temp(v) : String(v));
  const bw = Math.max(3, slot * 0.56);
  const every = width < 480 ? 6 : 3;
  const dateOf = (h: HourRow) =>
    new Date(
      Number(h.time.slice(0, 4)),
      Number(h.time.slice(5, 7)) - 1,
      Number(h.time.slice(8, 10)),
      Number(h.time.slice(11, 13)),
    );
  const mark = marker ? hours.findIndex((h) => h.time === marker) : -1;
  // Night shading across both bands, one rectangle per run of night hours.
  const nights: [number, number][] = [];
  hours.forEach((h, i) => {
    if (!h.night) return;
    const last = nights[nights.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else nights.push([i, i]);
  });
  return (
    <svg
      width={width}
      height={H}
      viewBox={`0 0 ${width} ${H}`}
      aria-hidden="true"
      focusable="false"
      data-option={s.option}
    >
      {nights.map(([a, b]) => (
        <rect
          key={`n${a}`}
          className={styles.night}
          x={L + a * slot}
          y={T0}
          width={(b - a + 1) * slot}
          height={B1 - T0}
        />
      ))}
      {ticks.map((v) => (
        <g key={`t${v}`}>
          <line
            className={v === 0 && temp ? styles.zero : styles.grid}
            x1={L}
            x2={width - R}
            y1={Y(v)}
            y2={Y(v)}
          />
          <text className={styles.axis} x={L - 6} y={Y(v) + 4} textAnchor="end">
            {label(v)}
          </text>
        </g>
      ))}
      {s.top?.unit ? (
        <text className={styles.axis} x={L - 6} y={T0 + 28} textAnchor="end">
          {s.top.unit}
        </text>
      ) : null}
      {s.topBars?.map((v, i) =>
        v != null && v > 0 ? (
          <rect
            key={`u${i}`}
            className={styles.sun}
            x={X(i) - bw / 2}
            y={Y(v)}
            width={bw}
            height={T1 - Y(v)}
            rx={1.5}
          />
        ) : null,
      )}
      {s.line2
        ? runs(s.line2, X, Y).map((d, i) => <path key={`b${i}`} className={styles.line2} d={d} />)
        : null}
      {s.line
        ? runs(s.line, X, Y).map((d, i) => (
            <path key={`a${i}`} className={styles.line} d={d} data-series="line" />
          ))
        : null}
      {mark >= 0 ? (
        <line
          className={styles.marker}
          x1={X(mark)}
          x2={X(mark)}
          y1={T0 - 4}
          y2={B1}
          data-testid="weather-chart-marker"
        />
      ) : null}
      {s.word ? (
        <text className={styles.word} x={L + 8} y={T0 + 16}>
          {s.word}
        </text>
      ) : null}
      {s.bars ? (
        <>
          <line className={styles.base} x1={L} x2={width - R} y1={B1} y2={B1} />
          {s.bars.map((v, i) => {
            if (v == null || v <= 0) return null;
            const h = Math.max(2, (v / (s.barsMax || 1)) * (B1 - B0));
            return (
              <rect
                key={`r${i}`}
                className={s.option === 'sun' ? styles.sun : styles.bar}
                x={X(i) - bw / 2}
                y={B1 - h}
                width={bw}
                height={h}
                rx={1.5}
              />
            );
          })}
        </>
      ) : null}
      {s.thin ? (
        <>
          {runs(s.thin, X, (v) => B1 - (v / 100) * (B1 - B0)).map((d, i) => (
            <path key={`c${i}`} className={styles.chance} d={d} />
          ))}
          <text className={styles.axis} x={L - 6} y={B0 + 4} textAnchor="end">
            100 %
          </text>
          <text className={styles.axis} x={L - 6} y={B1 + 4} textAnchor="end">
            0
          </text>
        </>
      ) : null}
      {s.arrows?.map((d, i) =>
        d == null || i % 3 ? null : (
          <g
            key={`d${i}`}
            transform={`translate(${X(i).toFixed(1)},${(B0 + B1) / 2}) rotate(${d + 180})`}
          >
            <path className={styles.arrow} d="M0,7L0,-7M-4,-3L0,-7L4,-3" />
          </g>
        ),
      )}
      {hours.map((h, i) =>
        i % every === 0 ? (
          <text key={`l${h.time}`} className={styles.axis} x={X(i)} y={LY} textAnchor="middle">
            {hourFmt.format(dateOf(h))}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/**
 * The curve with the select "Anzeigen" (CONCEPT-INFO §2): six series, the choice kept on the device. The picture is
 * `aria-hidden`; one sentence per series says what it shows, and a series without data says that instead.
 */
export function WeatherChart({
  hours,
  air,
  all,
  title,
  marker,
}: {
  hours: readonly HourRow[];
  /** The chosen hour (`time` of its row): a thin line marks it (CONCEPT-DAYS §2). */
  marker?: string;
  air?: Air;
  /** Every cached hour (the pressure tendency looks three hours back). */
  all?: readonly HourRow[];
  title: string;
}) {
  const tp = tWeatherPage.use();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [option, setOption] = useState<ChartOption>(readChartChoice);
  const titleId = useId();
  if (hours.length < 2) return null;
  const s = seriesOf(tp, option, hours, air, all);
  return (
    <section aria-labelledby={titleId} data-testid="weather-chart-card">
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <div className={styles.select}>
          <SelectField
            label={tp.chartShow}
            value={option}
            onChange={(e) => {
              const v = e.target.value;
              if (!isChartOption(v)) return;
              setOption(v);
              writeChartChoice(v);
            }}
            data-testid="weather-chart-select"
          >
            {CHART_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {tp.chartOptions[o]}
              </option>
            ))}
          </SelectField>
        </div>
      </div>
      <div ref={ref} className={styles.chart} data-testid="weather-chart" data-option={option}>
        {s.has ? (
          <>
            <Plot s={s} hours={hours} width={width} marker={marker} />
            <ul className={styles.legend} aria-hidden="true">
              {LEGEND[option].map((k) => (
                <li key={k}>
                  <span className={`${styles.swatch} ${SWATCH[k] ?? ''}`} />
                  {tp.legend[k]}
                </li>
              ))}
              {hours.some((h) => h.night) ? (
                <li>
                  <span className={`${styles.swatch} ${styles.swNight}`} />
                  {tp.legendNight}
                </li>
              ) : null}
            </ul>
            <p className="sr-only" data-testid="weather-chart-alt">
              {s.alt}
            </p>
          </>
        ) : (
          <p className={styles.missing} data-testid="weather-chart-alt">
            {s.alt}
          </p>
        )}
      </div>
    </section>
  );
}
