import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
  compilePlotFunction,
  preloadEngine,
  type AngleMode,
  type PlotFn,
} from '@/core/calc/engine';
import { CalcError } from '@/core/calc/expr';
import { formatNumber } from '@/core/i18n/format';
import { t } from '@/strings';
import { Button, Checkbox, Icon, IconButton, Segmented, TextField } from '@/ui';
import { num } from '../shared';
import styles from '../tools.module.css';
import {
  autoYRange,
  BOX,
  DEFAULT_VIEW,
  niceTicks,
  panView,
  px,
  py,
  sample,
  toPath,
  validRange,
  zoomView,
  type PlotView,
} from './plot';

const s = t.tools.calc.pro.plot;
const NAMES = ['f', 'g', 'h'] as const;
const FIRST = 'sin(x)';

interface Compiled {
  fn?: PlotFn;
  error?: string;
}

const fmt = (n: number) => formatNumber(n, { useGrouping: false, maximumFractionDigits: 6 });

export default function PlotMode() {
  // Radians here (a graph over -10 … 10 is meant that way); the calculator's own angle setting is left alone.
  const [angle, setAngle] = useState<AngleMode>('rad');
  const [exprs, setExprs] = useState<string[]>([FIRST, '', '']);
  const [xMin, setXMin] = useState(fmt(DEFAULT_VIEW.xMin));
  const [xMax, setXMax] = useState(fmt(DEFAULT_VIEW.xMax));
  const [yMin, setYMin] = useState(fmt(DEFAULT_VIEW.yMin));
  const [yMax, setYMax] = useState(fmt(DEFAULT_VIEW.yMax));
  const [yAuto, setYAuto] = useState(true);
  // Compiled functions by angle unit and text; filled by the effect below, never touched while typing.
  const [compiled, setCompiled] = useState<Record<string, Compiled>>({});

  useEffect(() => preloadEngine(), []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      for (const expr of exprs) {
        const text = expr.trim();
        const key = `${angle}|${text}`;
        if (text === '' || compiled[key]) continue;
        compilePlotFunction(text, angle).then(
          (fn) => !cancelled && setCompiled((c) => ({ ...c, [key]: { fn } })),
          (e: unknown) =>
            !cancelled &&
            setCompiled((c) => ({
              ...c,
              [key]: {
                error:
                  e instanceof CalcError
                    ? (t.tools.calc.errors[e.code] ?? t.tools.calc.errors.syntax)
                    : t.tools.calc.errors.syntax,
              },
            })),
        );
      }
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [exprs, angle, compiled]);

  const fns = exprs.map((e): Compiled | undefined => {
    const text = e.trim();
    return text === '' ? undefined : compiled[`${angle}|${text}`];
  });

  const x0 = num(xMin);
  const x1 = num(xMax);
  const xOk = x0 !== undefined && x1 !== undefined && validRange(x0, x1);
  const xRange = xOk ? ([x0, x1] as const) : ([DEFAULT_VIEW.xMin, DEFAULT_VIEW.xMax] as const);

  const series = useMemo(
    () => fns.map((f) => (f?.fn ? sample(f.fn, xRange[0], xRange[1]) : undefined)),
    // `fns` is rebuilt every render; its content only changes with these
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compiled, exprs, angle, xRange[0], xRange[1]],
  );

  const auto = autoYRange(series.filter((x): x is NonNullable<typeof x> => x !== undefined));
  const my0 = num(yMin);
  const my1 = num(yMax);
  const manualOk = my0 !== undefined && my1 !== undefined && validRange(my0, my1);
  const y: readonly [number, number] =
    yAuto || !manualOk ? (auto ?? [DEFAULT_VIEW.yMin, DEFAULT_VIEW.yMax]) : [my0!, my1!];
  const view: PlotView = { xMin: xRange[0], xMax: xRange[1], yMin: y[0], yMax: y[1] };
  const rangeError = !xOk || (!yAuto && !manualOk);

  function setView(v: PlotView, keepAuto: boolean) {
    setXMin(fmt(v.xMin));
    setXMax(fmt(v.xMax));
    if (!keepAuto) {
      setYMin(fmt(v.yMin));
      setYMax(fmt(v.yMax));
      setYAuto(false);
    }
  }
  const zoom = (f: number) => {
    const z = zoomView(view, f);
    // With "y automatisch" only x changes; the y range follows the values.
    setView(yAuto ? { ...view, xMin: z.xMin, xMax: z.xMax } : z, yAuto);
  };
  const pan = (dx: number, dy: number) => {
    const p = panView(view, dx, dy);
    setView(p, yAuto && dy === 0);
  };
  const reset = () => {
    setView(DEFAULT_VIEW, false);
    setYAuto(true);
  };
  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    const step = 0.1;
    const handled = {
      ArrowLeft: () => pan(-step, 0),
      ArrowRight: () => pan(step, 0),
      ArrowUp: () => pan(0, step),
      ArrowDown: () => pan(0, -step),
      '+': () => zoom(0.8),
      '=': () => zoom(0.8),
      '-': () => zoom(1.25),
      '0': reset,
    }[e.key];
    if (handled) {
      e.preventDefault();
      handled();
    }
  }

  const xTicks = niceTicks(view.xMin, view.xMax, 5);
  const yTicks = niceTicks(view.yMin, view.yMax, 4);
  const axisX = view.yMin <= 0 && view.yMax >= 0 ? py(view, 0) : undefined;
  const axisY = view.xMin <= 0 && view.xMax >= 0 ? px(view, 0) : undefined;
  const drawn = series.some((x) => x !== undefined);
  const hasValues = series.some((sr) => sr?.some((p) => Number.isFinite(p.y)));

  return (
    <div className={styles.stack}>
      <Segmented
        label={t.tools.calc.pro.angle}
        value={angle}
        options={[
          { value: 'rad' as const, label: t.tools.calc.pro.rad },
          { value: 'deg' as const, label: t.tools.calc.pro.deg },
        ]}
        onChange={setAngle}
      />
      <svg
        className={styles.plot}
        viewBox={`0 0 ${BOX.w} ${BOX.h}`}
        role="img"
        aria-label={s.chart(fmt(view.xMin), fmt(view.xMax), fmt(view.yMin), fmt(view.yMax))}
        tabIndex={0}
        onKeyDown={onKey}
        data-testid="plot"
      >
        <defs>
          <clipPath id="plot-clip">
            <rect x="0" y="0" width={BOX.w} height={BOX.h} />
          </clipPath>
        </defs>
        {xTicks.map((v) => (
          <line
            key={`gx${v}`}
            className={styles.plotGrid}
            x1={px(view, v)}
            x2={px(view, v)}
            y1="0"
            y2={BOX.h}
          />
        ))}
        {yTicks.map((v) => (
          <line
            key={`gy${v}`}
            className={styles.plotGrid}
            y1={py(view, v)}
            y2={py(view, v)}
            x1="0"
            x2={BOX.w}
          />
        ))}
        {axisX !== undefined ? (
          <line className={styles.plotAxis} x1="0" x2={BOX.w} y1={axisX} y2={axisX} />
        ) : null}
        {axisY !== undefined ? (
          <line className={styles.plotAxis} y1="0" y2={BOX.h} x1={axisY} x2={axisY} />
        ) : null}
        <g clipPath="url(#plot-clip)">
          {series.map((sr, i) =>
            sr ? (
              <path
                key={NAMES[i]}
                className={`${styles.plotLine} ${styles[`plotLine${i}`]}`}
                d={toPath(sr, view)}
                data-testid={`plot-line-${NAMES[i]}`}
              />
            ) : null,
          )}
        </g>
        {xTicks.map((v) => {
          const x = px(view, v);
          // Labels at the edge stay inside the box instead of being cut off.
          const anchor = x < 22 ? 'start' : x > BOX.w - 22 ? 'end' : 'middle';
          return (
            <text
              key={`tx${v}`}
              className={styles.plotLabel}
              x={x}
              y={BOX.h - 4}
              textAnchor={anchor}
            >
              {formatNumber(v, { maximumFractionDigits: 6 })}
            </text>
          );
        })}
        {yTicks
          .filter((v) => py(view, v) < BOX.h - 26) // the bottom row belongs to the x labels
          .map((v) => (
            <text key={`ty${v}`} className={styles.plotLabel} x="4" y={py(view, v) - 4}>
              {formatNumber(v, { maximumFractionDigits: 6 })}
            </text>
          ))}
      </svg>
      {!drawn ? (
        <p className={styles.muted}>{s.empty}</p>
      ) : !hasValues && !rangeError && fns.every((f) => f === undefined || f.fn) ? (
        <p className={styles.muted} role="status">
          {s.noValues}
        </p>
      ) : null}

      <div className={styles.controls} role="group" aria-label={s.moveGroup}>
        <IconButton label={s.zoomIn} onClick={() => zoom(0.8)}>
          <Icon name="plus" size={18} />
        </IconButton>
        <IconButton label={s.zoomOut} onClick={() => zoom(1.25)}>
          <Icon name="minus" size={18} />
        </IconButton>
        <IconButton label={s.left} onClick={() => pan(-0.25, 0)}>
          <Icon name="chevronLeft" size={18} />
        </IconButton>
        <IconButton label={s.right} onClick={() => pan(0.25, 0)}>
          <Icon name="chevronRight" size={18} />
        </IconButton>
        <IconButton label={s.up} onClick={() => pan(0, 0.25)}>
          <Icon name="chevronUp" size={18} />
        </IconButton>
        <IconButton label={s.down} onClick={() => pan(0, -0.25)}>
          <Icon name="chevronDown" size={18} />
        </IconButton>
        <Button onClick={reset}>{s.reset}</Button>
      </div>

      <ul className={styles.legend} aria-label={s.legend}>
        {exprs.map((e, i) =>
          fns[i]?.fn ? (
            <li key={NAMES[i]}>
              <svg width="36" height="10" aria-hidden="true">
                <line
                  x1="0"
                  x2="36"
                  y1="5"
                  y2="5"
                  className={`${styles.plotLine} ${styles[`plotLine${i}`]}`}
                />
              </svg>
              <span>{`${NAMES[i]}(x) = ${e.trim()}`}</span>
            </li>
          ) : null,
        )}
      </ul>
      {exprs.map((e, i) => (
        <TextField
          key={NAMES[i]}
          label={`${NAMES[i]}(x)`}
          value={e}
          onChange={(ev) => setExprs((list) => list.map((v, j) => (j === i ? ev.target.value : v)))}
          placeholder={i === 0 ? FIRST : s.optional}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          error={fns[i]?.error}
          data-autofocus={i === 0 ? true : undefined}
        />
      ))}
      <div className={styles.row}>
        <div className={styles.grow}>
          <TextField
            label={s.xFrom}
            value={xMin}
            onChange={(e) => setXMin(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
          />
        </div>
        <div className={styles.grow}>
          <TextField
            label={s.xTo}
            value={xMax}
            onChange={(e) => setXMax(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
          />
        </div>
      </div>
      <Checkbox label={s.yAuto} checked={yAuto} onChange={(e) => setYAuto(e.target.checked)} />
      {yAuto ? null : (
        <div className={styles.row}>
          <div className={styles.grow}>
            <TextField
              label={s.yFrom}
              value={yMin}
              onChange={(e) => setYMin(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
            />
          </div>
          <div className={styles.grow}>
            <TextField
              label={s.yTo}
              value={yMax}
              onChange={(e) => setYMax(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
            />
          </div>
        </div>
      )}
      {rangeError ? (
        <p className={styles.error} role="alert">
          {s.badRange}
        </p>
      ) : null}

      <p className={styles.muted}>{s.hint}</p>
    </div>
  );
}
