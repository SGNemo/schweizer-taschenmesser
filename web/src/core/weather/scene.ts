/**
 * The weather word by WMO code (package 1a of the weather scenes): the word follows the raw code, not the
 * group of nine, so "mainly clear" (1) is no longer called "partly cloudy". The picture's model joins this
 * file in package 1b (docs/design/weather-scenes/handoff/00-common.md).
 */
import type { tWeather } from '@/strings.weather';
import type { CodeGroup } from './logic';

export type ConditionId = keyof typeof tWeather.de.conditions;

/** The nearest word of a group, for values cached without a code. */
const GROUP_ID: Record<CodeGroup, ConditionId> = {
  clear: 'clear',
  partly: 'partly',
  cloudy: 'overcast',
  fog: 'fog',
  drizzle: 'drizzle',
  rain: 'rain',
  snow: 'snow',
  showers: 'showers',
  thunder: 'thunder',
};

const CODE_ID: Readonly<Record<number, ConditionId>> = {
  0: 'clear',
  1: 'mostlyClear',
  2: 'partly',
  3: 'overcast',
  45: 'fog',
  48: 'rimeFog',
  51: 'drizzle',
  53: 'drizzle',
  55: 'drizzle',
  56: 'freezingDrizzle',
  57: 'freezingDrizzle',
  61: 'rainLight',
  63: 'rain',
  65: 'rainHeavy',
  66: 'freezingRain',
  67: 'freezingRain',
  71: 'snowLight',
  73: 'snow',
  75: 'snowHeavy',
  77: 'snowGrains',
  80: 'showersLight',
  81: 'showers',
  82: 'showersHeavy',
  85: 'snowShowers',
  86: 'snowShowers',
  95: 'thunder',
  96: 'thunderHail',
  99: 'thunderHail',
};

/** Every WMO code Open-Meteo reports. */
export const WMO_CODES: readonly number[] = Object.keys(CODE_ID).map(Number);

/** The word's id for a WMO code; without a code (older cache) or for an unknown one, the group's nearest id. */
export function conditionId(code: number | undefined, group: CodeGroup): ConditionId {
  return (code != null ? CODE_ID[code] : undefined) ?? GROUP_ID[group];
}

/** The words that already say snow: "Schnee liegt" and "Frost" stand back behind them. */
const SNOW_IDS: ReadonlySet<ConditionId> = new Set([
  'snowLight',
  'snow',
  'snowHeavy',
  'snowGrains',
  'snowShowers',
]);

export type SceneAddition = 'storm' | 'windy' | 'snowLies' | 'frost' | 'heat';

export interface SceneAdditionInput {
  id: ConditionId;
  /** °C. */
  temp: number;
  /** km/h. */
  wind?: number;
  gust?: number;
  /** Snow on the ground, metres. */
  snowDepth?: number;
  night?: boolean;
}

/**
 * The one extra word after the weather word in the head's detail line (COPY §1), by priority: gale-force
 * gusts, windy, snow on the ground, frost, heat. Limits of the picture only: they change no rating and no hint.
 */
export function sceneAddition(i: SceneAdditionInput): SceneAddition | undefined {
  const wind = i.wind ?? 0;
  const gust = i.gust ?? 0;
  if (wind >= 50 || gust >= 70) return 'storm';
  if (gust >= 50 || wind >= 35) return 'windy';
  const snowWord = SNOW_IDS.has(i.id);
  const snowLies = !snowWord && (i.snowDepth ?? 0) >= 0.01;
  if (snowLies) return 'snowLies';
  if (i.temp <= 0 && !snowWord) return 'frost';
  if (i.temp >= 30 && !i.night) return 'heat';
  return undefined;
}
