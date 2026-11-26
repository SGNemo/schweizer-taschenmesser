/**
 * "Regen in den nächsten zwei Stunden" (CONCEPT-INFO §2, COPY §2): the first stretch of rain (or snow) in the eight
 * 15-minute amounts, read against the place's clock. Pure; the block and head chip 1 use it.
 */
import type { Forecast } from '@/core/weather/api';
import { hourAt } from '@/core/weather/derived';
import type { tWeatherPage } from '@/strings.weatherPage';
import { dec } from './components/parts';

/** A 15-minute amount from which it counts as rain, mm. */
export const SOON_WET_MM = 0.1;
const STEP_MIN = 15;

export type RainSoonKind =
  /** Starts later and ends inside the two hours. */
  | 'laterEnds'
  /** Starts later and is still falling at the end. */
  | 'laterOn'
  /** Falls now and ends inside. */
  | 'nowEnds'
  /** Falls now and all through. */
  | 'nowOn'
  /** One short burst (a single quarter hour) later. */
  | 'burst';

export interface RainSoon {
  kind: RainSoonKind;
  /** Local `HH:mm` of the first wet quarter hour. */
  from: string;
  /** Local `HH:mm` of the first dry quarter after it; absent while it goes on. */
  until?: string;
  /** Length of the stretch inside the window, minutes. */
  minutes: number;
  /** Amount of the stretch, mm (one decimal). */
  mm: number;
  /** Snow instead of rain (by the hour the stretch starts in). */
  snow: boolean;
  /** The quarter-hour amounts still ahead, the current one first (for the bars). */
  bars: number[];
}

const addMin = (iso: string, min: number): string =>
  new Date(Date.parse(`${iso}:00Z`) + min * 60_000).toISOString().slice(0, 16);

/**
 * The first wet stretch from the current quarter hour on; `null` without 15-minute values, when they are older
 * than the window or when no quarter hour ahead is wet. `nowIso` is the place's local `YYYY-MM-DDTHH:mm`.
 */
export function rainSoon(forecast: Forecast, nowIso: string): RainSoon | null {
  const soon = forecast.soon;
  if (!soon || soon.mm.length === 0) return null;
  const passed = Math.floor((Date.parse(`${nowIso}:00Z`) - Date.parse(`${soon.at}:00Z`)) / 60_000);
  if (!Number.isFinite(passed)) return null;
  const skip = Math.max(0, Math.floor(passed / STEP_MIN));
  const bars = soon.mm.slice(skip);
  if (bars.length === 0) return null;
  const first = bars.findIndex((v) => v >= SOON_WET_MM);
  if (first < 0) return null;
  let end = first;
  while (end < bars.length && bars[end]! >= SOON_WET_MM) end++;
  const start = addMin(soon.at, (skip + first) * STEP_MIN);
  const goesOn = end === bars.length;
  const kind: RainSoonKind =
    first === 0
      ? goesOn
        ? 'nowOn'
        : 'nowEnds'
      : goesOn
        ? 'laterOn'
        : end - first === 1
          ? 'burst'
          : 'laterEnds';
  const mm = Math.round(bars.slice(first, end).reduce((a, b) => a + b, 0) * 10) / 10;
  const hour = hourAt(forecast.hours, start);
  const snow = (hour?.snow ?? 0) > 0 || hour?.group === 'snow';
  return {
    kind,
    from: start.slice(11, 16),
    until: goesOn ? undefined : addMin(soon.at, (skip + end) * STEP_MIN).slice(11, 16),
    minutes: (end - first) * STEP_MIN,
    mm,
    snow,
    bars,
  };
}

type Tp = ReturnType<typeof tWeatherPage.get>;

/** Head chip 1 while rain is near (COPY §2): "Regen ab 14:20" · "Regen bis etwa 15:10" · "Schauer gegen 14:45". */
export function soonChip(tp: Tp, s: RainSoon): string {
  if (s.kind === 'burst') return s.snow ? tp.chipSnowShower(s.from) : tp.chipShower(s.from);
  if (s.kind === 'nowEnds') return s.snow ? tp.chipSnowUntil(s.until!) : tp.chipRainUntil(s.until!);
  if (s.kind === 'nowOn') return tp.keyRainNow;
  return s.snow ? tp.chipSnowFrom(s.from) : tp.chipRainFrom(s.from);
}

/** The one sentence above the bars; it says everything the bars show. */
export function soonSentence(tp: Tp, s: RainSoon): string {
  const w = s.snow ? tp.snowSoon : tp.rainSoon;
  switch (s.kind) {
    case 'laterEnds':
      return w.laterEnds(s.from, s.minutes, dec(s.mm));
    case 'laterOn':
      return w.laterOn(s.from);
    case 'nowEnds':
      return w.nowEnds(s.until!);
    case 'nowOn':
      return w.nowOn;
    case 'burst':
      return w.burst(s.from);
  }
}
