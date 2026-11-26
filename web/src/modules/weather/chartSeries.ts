/**
 * The six series of the curve (CONCEPT-INFO §2, COPY §5): which values each draws, whether there are any, and its
 * one-sentence text alternative. Pure; `WeatherChart` draws what this returns.
 */
import type { Air } from '@/core/weather/air';
import type { HourRow } from '@/core/weather/api';
import { pressureTendency } from '@/core/weather/derived';
import type { tWeatherPage } from '@/strings.weatherPage';
import { dec } from './components/parts';

type Tp = ReturnType<typeof tWeatherPage.get>;

export const CHART_OPTIONS = ['tempRain', 'wind', 'sun', 'pressure', 'uv', 'air'] as const;
export type ChartOption = (typeof CHART_OPTIONS)[number];
export const isChartOption = (v: unknown): v is ChartOption =>
  typeof v === 'string' && (CHART_OPTIONS as readonly string[]).includes(v);

/** Device-local choice of the curve (localStorage, never synced, not in diagnostics). */
export const CHART_KEY = 'tm-weather-chart';

export function readChartChoice(): ChartOption {
  try {
    const v = localStorage.getItem(CHART_KEY);
    return isChartOption(v) ? v : 'tempRain';
  } catch {
    return 'tempRain';
  }
}
export function writeChartChoice(v: ChartOption): void {
  try {
    if (v === 'tempRain') localStorage.removeItem(CHART_KEY);
    else localStorage.setItem(CHART_KEY, v);
  } catch {
    // Storage blocked: the choice lasts until the page is left.
  }
}

/** Values of one line or bar row, one per hour; `null` where an hour has none. */
export type Values = (number | null)[];

export interface Series {
  option: ChartOption;
  /** False: nothing to draw for this choice; the card shows `alt` as its sentence instead. */
  has: boolean;
  alt: string;
  /** The upper band: a main line, a second dashed line, or bars (UV). */
  line?: Values;
  line2?: Values;
  topBars?: Values;
  /** Fixed scale of the upper band (wind from 0, percentages 0–100). */
  top?: { lo: number; hi: number; unit?: string };
  /** The lower band: bars and a thin line on 0–100 %. */
  bars?: Values;
  barsMax?: number;
  thin?: Values;
  /** Wind direction per hour (deg, where it comes from), drawn every three hours. */
  arrows?: Values;
  /** Pressure: the word drawn into the band. */
  word?: string;
}

const pick = (hours: readonly HourRow[], f: (h: HourRow) => number | undefined): Values =>
  hours.map((h) => f(h) ?? null);
const known = (v: Values): number[] => v.filter((n): n is number => n != null);
const hh = (h: HourRow | undefined) => (h ? h.time.slice(11, 13) : '');
const argMax = (v: Values): number => {
  let best = -1;
  v.forEach((n, i) => {
    if (n != null && (best < 0 || n > v[best]!)) best = i;
  });
  return best;
};

/** Every hour has a value (a line with gaps is not drawn). */
const whole = (v: Values) => v.length > 1 && v.every((n) => n != null);

export function seriesOf(
  tp: Tp,
  option: ChartOption,
  hours: readonly HourRow[],
  air?: Air,
  /** All cached hours, for the pressure tendency of the first hour (three hours back). */
  all: readonly HourRow[] = hours,
): Series {
  const A = tp.chartAlt;
  const none = (alt = tp.hourMissing): Series => ({ option, has: false, alt });
  switch (option) {
    case 'tempRain': {
      const line = pick(hours, (h) => h.temp);
      if (!whole(line)) return none();
      const feels = pick(hours, (h) => h.feels);
      const bars = pick(hours, (h) => h.mm);
      const t = known(line);
      const sum = known(bars).reduce((a, b) => a + b, 0);
      const wettest = argMax(bars);
      const rain =
        sum >= 0.1 && wettest >= 0
          ? A.rain(dec(Math.round(sum * 10) / 10), hh(hours[wettest]))
          : A.noRain;
      return {
        option,
        has: true,
        alt: `${A.temp(Math.min(...t), Math.max(...t), hh(hours[argMax(line)]))}; ${rain}.`,
        line,
        line2: whole(feels) ? feels : undefined,
        bars,
        barsMax: Math.max(2, ...known(bars)),
        thin: pick(hours, (h) => h.rain),
      };
    }
    case 'wind': {
      const line = pick(hours, (h) => h.wind);
      if (!whole(line)) return none();
      const gusts = pick(hours, (h) => h.gust);
      const w = known(line);
      const g = known(gusts);
      const peak = whole(gusts) ? argMax(gusts) : argMax(line);
      const top = Math.max(10, Math.ceil(Math.max(...w, ...g) / 10) * 10);
      return {
        option,
        has: true,
        alt: `${A.wind(Math.min(...w), Math.max(...w), g.length > 0 ? Math.max(...g) : Math.max(...w), hh(hours[peak]))}.`,
        line,
        line2: whole(gusts) ? gusts : undefined,
        top: { lo: 0, hi: top, unit: 'km/h' },
        arrows: pick(hours, (h) => h.dir),
      };
    }
    case 'sun': {
      const cloud = pick(hours, (h) => h.cloud);
      const sun = pick(hours, (h) => h.sunMin);
      if (!whole(cloud) && known(sun).length === 0) return none();
      const c = known(cloud);
      const total = known(sun).reduce((a, b) => a + b, 0) / 60;
      return {
        option,
        has: true,
        alt: `${A.sun(dec(Math.round(total * 10) / 10), c.length ? Math.min(...c) : 0, c.length ? Math.max(...c) : 0)}.`,
        line: whole(cloud) ? cloud : undefined,
        top: { lo: 0, hi: 100, unit: '%' },
        bars: sun,
        barsMax: 60,
      };
    }
    case 'pressure': {
      const line = pick(hours, (h) => h.hpa);
      if (!whole(line)) return none();
      const p = known(line);
      const tendency = hours[0] ? pressureTendency(all, hours[0].time) : undefined;
      const word = tendency ? tp.tendency[tendency] : undefined;
      const lo = Math.min(...p);
      const hi = Math.max(...p);
      return {
        option,
        has: true,
        alt: `${word ? A.pressure(lo, hi, word) : A.pressureRange(lo, hi)}.`,
        line,
        top: { lo: Math.floor(lo - 2), hi: Math.ceil(hi + 2), unit: 'hPa' },
        word,
      };
    }
    case 'uv': {
      const uv = hours.map((h) => (h.night || h.uv == null ? null : h.uv));
      if (hours.every((h) => h.uv == null)) return none();
      const top = argMax(uv);
      const max = top >= 0 ? uv[top]! : 0;
      return {
        option,
        has: true,
        alt: max >= 0.5 ? `${A.uv(dec(max), hh(hours[top]))}.` : `${A.noUv}.`,
        topBars: uv,
        top: { lo: 0, hi: Math.max(8, Math.ceil(max)) },
      };
    }
    case 'air': {
      const byTime = new Map((air?.hours ?? []).map((a) => [a.t, a.aqi]));
      const line: Values = hours.map((h) => byTime.get(h.time) ?? null);
      const a = known(line);
      if (a.length < 2) return none(tp.airMissing);
      return {
        option,
        has: true,
        alt: `${A.air(Math.min(...a), Math.max(...a))}.`,
        line,
        top: { lo: 0, hi: Math.max(60, Math.ceil(Math.max(...a) / 20) * 20) },
      };
    }
  }
}
