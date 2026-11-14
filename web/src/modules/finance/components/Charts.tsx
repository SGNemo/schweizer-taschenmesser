import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { formatMoney, formatMoneyAxis } from '@/core/money';
import { useCurrency } from '../currency';
import { t } from '@/strings';
import type { CategoryTotal, MonthPoint } from '../logic';
import styles from '../routes/finance.module.css';

/**
 * The overview's two bar charts, drawn as plain elements (no chart library): bars are boxes sized in per cent of the
 * plot, so the browser lays them out at any width without a measuring pass, and the grow-in is a CSS transform
 * (no re-render per frame). Recharts did the same picture at 0.7 s of main thread per visit
 * (docs/perf/FINANCE-MAIL-2026-11.md). Each chart has a table twin (`CategoryTable`, `TrendTable`).
 *
 * Hover, a tap or the arrow keys (the plot takes focus) pick a category or month: its band is shaded, its bars lighten
 * and a tooltip names the values.
 */

/** Long category names are cut in the axis; the tooltip and table carry the full text. */
const shorten = (s: string) => (s.length > 16 ? `${s.slice(0, 15)}…` : s);

/** Picked row or column and where the tooltip stands (px inside the chart box). */
interface Pick {
  index: number;
  x: number;
  y: number;
  /** Size of the chart box, so the tooltip stays inside it. */
  w: number;
  h: number;
}

/**
 * Pointer and keyboard picking over `count` bands along one axis. `bandOf` turns a pointer position (px inside the
 * chart box) into a band index; `spotOf` puts the tooltip on the band's middle along that axis and at the pointer
 * across it (as the former chart did; the keys have no pointer, so `across` is undefined there).
 */
function usePick(
  count: number,
  bandOf: (x: number, y: number, box: DOMRect) => number,
  spotOf: (
    index: number,
    box: DOMRect,
    across?: { x: number; y: number },
  ) => { x: number; y: number },
) {
  const [pick, setPick] = useState<Pick | null>(null);
  const onPointer = (e: PointerEvent<HTMLElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    const index = bandOf(x, y, box);
    if (index < 0 || index >= count) return setPick(null);
    setPick({ index, ...spotOf(index, box, { x, y }), w: box.width, h: box.height });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0) {
      if (e.key === 'Escape') setPick(null);
      return;
    }
    e.preventDefault();
    const index =
      pick === null
        ? step > 0
          ? 0
          : count - 1
        : Math.min(count - 1, Math.max(0, pick.index + step));
    const box = e.currentTarget.getBoundingClientRect();
    setPick({ index, ...spotOf(index, box), w: box.width, h: box.height });
  };
  return {
    pick,
    handlers: {
      onPointerMove: onPointer,
      onPointerDown: onPointer,
      onPointerLeave: () => setPick(null),
      onKeyDown,
      onBlur: () => setPick(null),
    },
  };
}

/**
 * The tooltip box, 10 px right of and below the pointer; where it would reach past the plot (the box less `right` and
 * `bottom` px of axis room) it goes to the left of or above the pointer instead, as the former chart did. Placed after
 * its own size is known, without another render.
 */
function Tip({
  at,
  right,
  bottom,
  children,
}: {
  at: Pick;
  right: number;
  bottom: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { offsetWidth: w, offsetHeight: h } = el;
    const x = at.x + 10 + w <= at.w - right ? at.x + 10 : Math.max(0, at.x - 10 - w);
    const y = at.y + 10 + h <= at.h - bottom ? at.y + 10 : Math.max(0, at.y - 10 - h);
    el.style.transform = `translate(${x}px, ${y}px)`;
  }, [at, right, bottom]);
  return (
    <div ref={ref} className={styles.tipLayer}>
      <div className={styles.tooltip} data-testid="chart-tooltip">
        {children}
      </div>
    </div>
  );
}

/** Row height of the category bars (px); the box is `--bars` rows plus 8 px (`.barsBox`). */
const ROW = 40;

/**
 * Expenses per category. One measure, nominal categories → one colour for all bars, sorted by
 * size, value at the bar tip. Hit target = the bar's row; the table twin carries every value.
 */
export function CategoryBars({ rows }: { rows: CategoryTotal[] }) {
  const currency = useCurrency();
  const max = Math.max(0, ...rows.map((r) => r.amountMinor)) || 1;
  const { pick, handlers } = usePick(
    rows.length,
    (_x, y) => Math.floor((y - 4) / ROW),
    (i, box, at) => ({ x: at?.x ?? box.width / 2, y: 4 + i * ROW + ROW / 2 }),
  );
  const row = pick ? rows[pick.index] : undefined;
  return (
    <div
      className={`${styles.barsBox} ${styles.plotBox}`}
      style={{ '--bars': rows.length } as CSSProperties}
      data-testid="chart-categories"
      role="group"
      aria-label={t.finance.expensesByCategory}
      tabIndex={0}
      {...handlers}
    >
      <ul className={styles.barRows}>
        {rows.map((r, i) => (
          <li
            key={r.categoryId ?? r.name}
            className={`${styles.barRow} ${pick?.index === i ? styles.picked : ''}`}
          >
            <span className={styles.barName}>{shorten(r.name)}</span>
            <span className={styles.barPlot}>
              <span className={styles.bar} style={{ width: `${(r.amountMinor / max) * 100}%` }} />
              <span className={styles.barValue}>{formatMoney(r.amountMinor, currency)}</span>
            </span>
          </li>
        ))}
      </ul>
      {pick && row ? (
        <Tip at={pick} right={88} bottom={4}>
          <div className={styles.tooltipTitle}>{row.name}</div>
          <div className={styles.tooltipRow}>
            <span className={styles.lineKey} style={{ background: 'var(--viz-1)' }} />
            <span className={styles.tooltipValue}>{formatMoney(row.amountMinor, currency)}</span>
          </div>
        </Tip>
      ) : null}
    </div>
  );
}

const SERIES = [
  {
    key: 'income',
    get name() {
      return t.finance.income;
    },
    color: 'var(--viz-1)',
  },
  {
    key: 'expense',
    get name() {
      return t.finance.expense;
    },
    color: 'var(--viz-2)',
  },
] as const;

/**
 * Axis steps from zero: four steps of a "nice" size (the step rounded up to 0.05 of its power of ten: 748.50 → 750),
 * more when the largest value needs them.
 */
export function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1, 2, 3, 4];
  const rough = max / 4;
  const power = 10 ** (Math.floor(Math.log10(rough)) + 1);
  const step = Math.ceil(rough / power / 0.05 - 1e-9) * 0.05 * power || rough;
  const n = Math.max(4, Math.ceil(max / step - 1e-9));
  return Array.from({ length: n + 1 }, (_, i) => Math.round(i * step));
}

/** Width of the value axis (px) and the height of the month axis under the plot (px). */
const Y_AXIS = 52;
const X_AXIS = 30;

/** Income vs. expenses per month: two series → legend (round swatches) above, grouped columns with a 2px gap. */
export function TrendColumns({ points }: { points: MonthPoint[] }) {
  const currency = useCurrency();
  const ticks = niceTicks(Math.max(0, ...points.flatMap((p) => [p.income, p.expense])));
  const top = ticks.at(-1) || 1;
  const { pick, handlers } = usePick(
    points.length,
    (x, y, box) =>
      x < Y_AXIS || y > box.height - X_AXIS
        ? -1
        : Math.floor(((x - Y_AXIS) / (box.width - Y_AXIS - 4)) * points.length),
    (i, box, at) => ({
      x: Y_AXIS + ((i + 0.5) / points.length) * (box.width - Y_AXIS - 4),
      y: at?.y ?? box.height / 3,
    }),
  );
  const point = pick ? points[pick.index] : undefined;
  return (
    <div data-testid="chart-trend">
      <ul className={styles.seriesLegend} aria-label={t.finance.chartLegend}>
        {SERIES.map((s) => (
          <li key={s.key}>
            <span className={styles.seriesSwatch} style={{ background: s.color }} />
            {s.name}
          </li>
        ))}
      </ul>
      <div
        className={`${styles.trendBox} ${styles.plotBox}`}
        role="group"
        aria-label={t.finance.trend}
        tabIndex={0}
        {...handlers}
      >
        <div className={styles.yAxis} aria-hidden="true">
          {ticks.map((v) =>
            v === top ? (
              <span key={v} className={styles.topTick}>
                {formatMoneyAxis(v)}
              </span>
            ) : (
              <span key={v} style={{ bottom: `${(v / top) * 100}%` }}>
                {formatMoneyAxis(v)}
              </span>
            ),
          )}
        </div>
        <div className={styles.columnsPlot}>
          {ticks.map((v) => (
            <span key={v} className={styles.gridLine} style={{ bottom: `${(v / top) * 100}%` }} />
          ))}
          {points.map((p, i) => (
            <div
              key={p.month}
              className={`${styles.columnBand} ${pick?.index === i ? styles.picked : ''}`}
            >
              {SERIES.map((s) => (
                <span
                  key={s.key}
                  className={styles.column}
                  style={{ height: `${(p[s.key] / top) * 100}%`, background: s.color }}
                />
              ))}
              <span className={styles.columnLabel}>{p.label}</span>
            </div>
          ))}
        </div>
        {pick && point ? (
          <Tip at={pick} right={4} bottom={X_AXIS}>
            <div className={styles.tooltipTitle}>{point.label}</div>
            {SERIES.map((s) => (
              <div key={s.key} className={styles.tooltipRow}>
                <span className={styles.lineKey} style={{ background: s.color }} />
                <span className={styles.tooltipValue}>{formatMoney(point[s.key], currency)}</span>
                <span className={styles.tooltipName}>{s.name}</span>
              </div>
            ))}
          </Tip>
        ) : null}
      </div>
    </div>
  );
}

/** Table twin of the category chart (every value reachable without hover). */
export function CategoryTable({ rows }: { rows: CategoryTotal[] }) {
  const currency = useCurrency();
  return (
    <table className={styles.table} data-testid="table-categories">
      <thead>
        <tr>
          <th scope="col">{t.finance.category}</th>
          <th scope="col" className={styles.num}>
            {t.finance.amount}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.categoryId ?? r.name}>
            <td>{r.name}</td>
            <td className={styles.num}>{formatMoney(r.amountMinor, currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Table twin of the trend chart. */
export function TrendTable({ points }: { points: MonthPoint[] }) {
  const currency = useCurrency();
  return (
    <table className={styles.table} data-testid="table-trend">
      <thead>
        <tr>
          <th scope="col">{t.finance.month_}</th>
          <th scope="col" className={styles.num}>
            {t.finance.income}
          </th>
          <th scope="col" className={styles.num}>
            {t.finance.expense}
          </th>
          <th scope="col" className={styles.num}>
            {t.finance.net}
          </th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.month}>
            <td>{p.label}</td>
            <td className={styles.num}>{formatMoney(p.income, currency)}</td>
            <td className={styles.num}>{formatMoney(p.expense, currency)}</td>
            <td className={styles.num}>{formatMoney(p.net, currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
