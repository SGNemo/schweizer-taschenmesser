/**
 * The weather scene's pure model (docs/design/weather-scenes, CONCEPT §2–§3, handoff 00/01a/01b): the word by WMO
 * code (package 1a) and the state the picture is drawn from (package 1b) – phase of the day, condition and its
 * intensity, wind, frost, heat, snow on the ground, season, the sun on its arc, the sky family and the ink. Field
 * names follow the mockup's `state` (`mockups/scene.js`), so the drawing in `ui/weather-scene` is a straight port.
 */
import type { SceneEvent } from '@/core/sky/events';
import type { tWeather } from '@/strings.weather';
import type { Forecast } from './api';
import { placeNowIso, type CodeGroup } from './logic';

export type { SceneEvent };

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

/**
 * What a row may know beyond its code (round 2, handoff 00 "Hour row"): the amount, gusts, CAPE, visibility and the
 * three cloud heights. Every field is optional – package B fetches the new ones; until then they are absent.
 */
export interface WordData {
  /** mm in the hour. */
  mm?: number;
  /** km/h. */
  gust?: number;
  /** J/kg. */
  cape?: number;
  /** Visibility, m. */
  vis?: number;
  cloudLow?: number;
  cloudMid?: number;
  cloudHigh?: number;
}

/**
 * The word's id for a WMO code; without a code (older cache) or for an unknown one, the group's nearest id. With the
 * row's data the thunder and fog words say their level and thin high cloud says "Schleierwolken" (COPY §1): the same
 * level functions the picture draws from, so the word and the picture never disagree.
 */
export function conditionId(
  code: number | undefined,
  group: CodeGroup,
  data: WordData = {},
): ConditionId {
  const id = (code != null ? CODE_ID[code] : undefined) ?? GROUP_ID[group];
  if (id === 'thunder' || id === 'thunderHail') {
    const lvl = thunderLevel(code ?? 95, data.mm, data.gust, data.cape);
    if (id === 'thunderHail') return lvl >= 3 ? 'thunderHailSevere' : 'thunderHail';
    return lvl === 1 ? 'thunderLight' : lvl === 3 ? 'thunderSevere' : 'thunder';
  }
  if (id === 'fog' || id === 'rimeFog') {
    const dense = fogLevel(code ?? 45, data.vis) === 2;
    return dense ? (id === 'rimeFog' ? 'rimeFogDense' : 'fogDense') : id;
  }
  if ((code === 1 || code === 2 || code === 3) && veilOf(data)) return 'veil';
  return id;
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

/* ============================== package 1b: the picture's state ============================== */

export type Phase = 'night' | 'dawn' | 'golden' | 'day' | 'dusk';
/** The drawn condition (CONCEPT §3); fog with rime is `fog` with frost 1. */
export type Cond =
  | 'clear'
  | 'mostlyClear'
  | 'partly'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'freezingDrizzle'
  | 'rain'
  | 'freezingRain'
  | 'snow'
  | 'showers'
  | 'snowShowers'
  | 'thunder'
  | 'thunderHail';
export type Intensity = 1 | 2 | 3;
export type Level = 0 | 1 | 2 | 3;
export type Cover = 0 | 1 | 2 | 3 | 4;
export type BodyMode = 'clear' | 'veil' | 'hole' | 'schein' | '';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type SceneTheme = 'light' | 'dark';
/** "Bild im Wetter-Kopf": `full` = every layer, `plain` = sky and body only ("Schlicht"). */
export type SceneLevel = 'full' | 'plain';
export type SkyKey =
  | 'night'
  | 'night-full'
  | 'night-overcast'
  | 'night-rain'
  | 'night-snow'
  | 'night-fog'
  | 'dawn'
  | 'dusk'
  | 'golden'
  | 'day'
  | 'overcast'
  | 'drizzle'
  | 'rain'
  | 'storm'
  | 'snow'
  | 'fog'
  | 'heat'
  | 'dust'
  | 'eclipse-sky';

export interface SceneState {
  phase: Phase;
  theme: SceneTheme;
  cond: Cond;
  intensity: Intensity;
  /** Cloud cover, percent (the condition's default when the forecast has none). */
  cloud: number;
  /** Round 2 (CONCEPT §3): cloud level 0 none … 4 the deck. */
  cover: Cover;
  /** Thin high cloud: streaks and a ring round the body. */
  veil: boolean;
  /** How sunny (day): 0 … 3. */
  sun: Level;
  /** Thunder level, 0 without. */
  thunder: Level;
  /** Fog level, 0 without. */
  fog: 0 | 1 | 2;
  /** Snow on the ground: 1 dusted, 2 closed, 3 deep. */
  snowCover: Level;
  /** Where the wind blows in the picture (the lee side). */
  windTo: 'left' | 'right';
  /** Puddles: rain now or in the hour before. */
  wet: boolean;
  /** How the body is seen (CONCEPT §2); '' without a body. */
  mode: BodyMode;
  wind: Level;
  /** 0 none, 1 at 0° and below with nothing falling (and rime fog), 2 at −5° and below. */
  frost: 0 | 1 | 2;
  heat: boolean;
  season: Season;
  /**
   * The sun on its arc (`t` 0 = sunrise, 1 = sunset), or the moon while it is up at night, dawn and dusk (`t` from its
   * azimuth, `alt` its altitude in degrees); `none` otherwise (CONCEPT-MOON §4).
   */
  body: { kind: 'sun' | 'moon' | 'none'; t: number; alt?: number };
  /** The moon's lit fraction, the direction of its lit side (deg, + = left of up) and its size (1, full 1.2, super 1.35). */
  moon?: { illum: number; tilt: number; size: number; t?: number; alt?: number };
  /** A small pale moon by day (CONCEPT-MOON §4). */
  dayMoon?: boolean;
  /** The sky event drawn now (package 3, CONCEPT-EVENTS §1); only one at a time. */
  event?: SceneEvent;
  /** 0…1: the share of the sun covered (solar) or of the moon in the umbra (lunar); 1 for the others, 0 without. */
  eventAmount: number;
  calm: boolean;
  level: SceneLevel;
  motion: boolean;
  landscape: 'mountains';
  seed: number;
}

/** Limits of the picture (CONCEPT §3): wind 2 and 3 are the rating's, frost −5° the hint's; the rest are new. */
export const WIND_LIMITS: readonly { level: Level; wind: number; gust: number }[] = [
  { level: 3, wind: 50, gust: 70 },
  { level: 2, wind: 35, gust: 50 },
  { level: 1, wind: 20, gust: 35 },
];
export const FROST_C = 0;
export const HARD_FROST_C = -5;
export const HEAT_C = 30;
export const SNOW_LIES_M = 0.01;
/** Minutes of the twilight phases (CONCEPT §2). */
export const DAWN_MIN = 40;
export const GOLDEN_MORNING_MIN = 45;
export const GOLDEN_EVENING_MIN = 60;
export const DUSK_MIN = 40;

const minutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * The phase of the day at the place's local time (`nowIso` = `YYYY-MM-DDTHH:mm`) from today's sunrise and sunset
 * (`HH:mm`); without them (polar day or night, older values) `isDay` decides between day and night.
 */
export function phaseOf(
  nowIso: string,
  sunrise: string | undefined,
  sunset: string | undefined,
  isDay: boolean,
): Phase {
  if (!sunrise || !sunset) return isDay ? 'day' : 'night';
  const m = minutes(nowIso.slice(11, 16));
  const sr = minutes(sunrise);
  const ss = minutes(sunset);
  if (m < sr - DAWN_MIN) return 'night';
  if (m < sr) return 'dawn';
  if (m < sr + GOLDEN_MORNING_MIN) return 'golden';
  if (m < ss - GOLDEN_EVENING_MIN) return 'day';
  if (m < ss) return 'golden';
  if (m < ss + DUSK_MIN) return 'dusk';
  return 'night';
}

const CODE_COND: Readonly<Record<number, readonly [Cond, Intensity]>> = {
  0: ['clear', 2],
  1: ['mostlyClear', 2],
  2: ['partly', 2],
  3: ['overcast', 2],
  45: ['fog', 2],
  48: ['fog', 2],
  51: ['drizzle', 1],
  53: ['drizzle', 2],
  55: ['drizzle', 3],
  56: ['freezingDrizzle', 1],
  57: ['freezingDrizzle', 3],
  61: ['rain', 1],
  63: ['rain', 2],
  65: ['rain', 3],
  66: ['freezingRain', 1],
  67: ['freezingRain', 3],
  71: ['snow', 1],
  73: ['snow', 2],
  75: ['snow', 3],
  77: ['snow', 1],
  80: ['showers', 1],
  81: ['showers', 2],
  82: ['showers', 3],
  85: ['snowShowers', 1],
  86: ['snowShowers', 3],
  95: ['thunder', 2],
  96: ['thunderHail', 2],
  99: ['thunderHail', 3],
};
const GROUP_COND: Record<CodeGroup, Cond> = {
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

/** The drawn condition and its strength from the WMO code; without a code from the group, at intensity 2. */
export function condOf(
  code: number | undefined,
  group: CodeGroup,
): { cond: Cond; intensity: Intensity } {
  const hit = code != null ? CODE_COND[code] : undefined;
  return hit ? { cond: hit[0], intensity: hit[1] } : { cond: GROUP_COND[group], intensity: 2 };
}

/** Wind level of the picture: 1 from wind 20 or gusts 35, 2 from 35 / 50, 3 from 50 / 70 km/h. */
export function windLevel(wind: number | undefined, gust: number | undefined): Level {
  const w = wind ?? 0;
  const g = gust ?? 0;
  return WIND_LIMITS.find((l) => w >= l.wind || g >= l.gust)?.level ?? 0;
}

/** Conditions where something falls (the picture's precipitation). */
export const FALLING: ReadonlySet<Cond> = new Set<Cond>([
  'drizzle',
  'freezingDrizzle',
  'rain',
  'freezingRain',
  'snow',
  'showers',
  'snowShowers',
  'thunder',
  'thunderHail',
]);
const SNOWING: ReadonlySet<Cond> = new Set<Cond>(['snow', 'snowShowers']);

/** Frost of the picture: 2 at −5° and below, 1 at 0° and below while nothing falls; rime fog (48) is at least 1. */
export function frostLevel(temp: number, cond: Cond, code?: number): 0 | 1 | 2 {
  const level = temp <= HARD_FROST_C ? 2 : temp <= FROST_C && !FALLING.has(cond) ? 1 : 0;
  return code === 48 ? (Math.max(level, 1) as 1 | 2) : level;
}

/** Meteorological season of the place: shifted by six months south of the equator; the tropics are summer. */
export function seasonOf(month: number, lat: number): Season {
  if (Math.abs(lat) < 23.5) return 'summer';
  const m = lat < 0 ? ((month + 5) % 12) + 1 : month;
  return m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn';
}

/** Cloud cover the condition stands for when the forecast gives none (mockup `CLOUD_DEFAULT`). */
const CLOUD_DEFAULT: Record<Cond, number> = {
  clear: 5,
  mostlyClear: 25,
  partly: 50,
  overcast: 95,
  fog: 0,
  drizzle: 90,
  freezingDrizzle: 90,
  rain: 95,
  freezingRain: 95,
  showers: 60,
  snow: 95,
  snowShowers: 60,
  thunder: 92,
  thunderHail: 92,
};

/* ============================== round 2: levels (CONCEPT §2–§3) ============================== */

/** Cloud: limits of `c` (percent) for levels 0 … 3; above the last one the deck. */
export const COVER_LIMITS: readonly number[] = [10, 35, 60, 85];

/** What one hour row may carry (handoff 00 "Hour row"); every field is optional until package B delivers it. */
export interface SceneHour extends WordData {
  time?: string;
  temp?: number;
  code?: number;
  group?: CodeGroup;
  wind?: number;
  dir?: number;
  cloud?: number;
  /** Minutes of sunshine in the hour (0–60). */
  sunMin?: number;
  /** Snow on the ground, m. */
  snowDepth?: number;
  night?: boolean;
}

/**
 * The cloud level: `c` is the larger of low and middle cloud when the three heights are known (so thin high cloud alone
 * is never a deck), else the total cover; without any value the condition's default.
 */
export function coverOf(h: SceneHour, fallback?: number): Cover {
  const heights = h.cloudLow != null && h.cloudMid != null && h.cloudHigh != null;
  const c = heights ? Math.max(h.cloudLow!, h.cloudMid!) : (h.cloud ?? fallback);
  if (c == null) return 4;
  const i = COVER_LIMITS.findIndex((l) => c <= l);
  return (i < 0 ? 4 : i) as Cover;
}

/** Thin high cloud: high ≥ 50 % with low and middle cloud ≤ 30 %; needs all three heights. */
export function veilOf(h: WordData): boolean {
  if (h.cloudLow == null || h.cloudMid == null || h.cloudHigh == null) return false;
  return h.cloudHigh >= 50 && h.cloudLow <= 30 && h.cloudMid <= 30;
}

/**
 * How sunny (by day): the minutes of sunshine win where they exist (≥ 45 · 20 · 5), else the cover (≤ 1 → 3,
 * 2 → 2, 3 → 1). Under a deck never rays: 0.
 */
export function sunLevel(h: { sunMin?: number }, cover: Cover): Level {
  if (cover === 4) return 0;
  const m = h.sunMin;
  if (m != null) return m >= 45 ? 3 : m >= 20 ? 2 : m >= 5 ? 1 : 0;
  return cover <= 1 ? 3 : cover === 2 ? 2 : 1;
}

/** Rain or snow strength from the amount, for a cached value without a code: < 2.5 · < 7.5 · ≥ 7.5 mm/h. */
export function intensityOfAmount(mm: number): Intensity {
  return mm < 2.5 ? 1 : mm < 7.5 ? 2 : 3;
}

/**
 * Thunder level: 0 without thunder (WMO 95, 96, 99). 3 for 99, or ≥ 10 mm, gusts ≥ 70 km/h or CAPE ≥ 2000 J/kg.
 * 1 for 95 with a known amount < 2.5 mm, gusts < 50 and CAPE < 800 (unknown gusts and CAPE count as low; an unknown
 * amount does not make a storm light). 2 in every other case; 96 is at least 2.
 */
export function thunderLevel(
  code: number | undefined,
  mm: number | undefined,
  gust: number | undefined,
  cape: number | undefined,
): Level {
  if (code !== 95 && code !== 96 && code !== 99) return 0;
  if (code === 99 || (mm ?? 0) >= 10 || (gust ?? 0) >= 70 || (cape ?? 0) >= 2000) return 3;
  if (code === 95 && mm != null && mm < 2.5 && (gust ?? 0) < 50 && (cape ?? 0) < 800) return 1;
  return 2;
}

/** Fog level: 0 without fog (WMO 45 / 48), 2 with visibility < 300 m, else 1 (no other fallback). */
export function fogLevel(code: number | undefined, vis: number | undefined): 0 | 1 | 2 {
  if (code !== 45 && code !== 48) return 0;
  return vis != null && vis < 300 ? 2 : 1;
}

/** Snow on the ground: ≥ 1 · ≥ 5 · ≥ 20 cm; snowing at level ≥ 2 is at least 1. */
export function snowCoverOf(depthM: number | undefined, snowLevel: number): Level {
  const cm = (depthM ?? 0) * 100;
  const lvl: Level = cm >= 20 ? 3 : cm >= 5 ? 2 : cm >= 1 ? 1 : 0;
  return snowLevel >= 2 && lvl === 0 ? 1 : lvl;
}

/**
 * Where the wind blows in the picture. It looks toward the sun's arc: south in the northern hemisphere (east left,
 * west right), north in the southern. North: from 180°–360° (a westerly) to the left, from 0°–180° to the right;
 * south mirrored. Without a direction: to the right.
 */
export function windTo(dirDeg: number | undefined, lat: number): 'left' | 'right' {
  if (dirDeg == null) return 'right';
  const d = ((dirDeg % 360) + 360) % 360;
  const westerly = d >= 180;
  return westerly === lat >= 0 ? 'left' : 'right';
}

/** Puddles: it rains now, or ≥ 0.2 mm fell in the hour before. */
export function wetOf(rainingNow: boolean, previous: { mm?: number } | undefined): boolean {
  return rainingNow || (previous?.mm ?? 0) >= 0.2;
}

/**
 * How the body is seen (CONCEPT §2): `schein` (pale) under a deck with rain, snow or fog, in fog level 2 and in
 * thunder from level 2; `hole` under a dry deck; `veil` with thin high cloud; else `clear`. "Schlicht" under a deck
 * draws no clouds, so the body stands pale. No body: ''.
 */
export function bodyMode(s: {
  body: { kind: string };
  cover: Cover;
  veil: boolean;
  thunder: Level;
  fog: 0 | 1 | 2;
  falling: boolean;
  level?: SceneLevel;
}): BodyMode {
  if (s.body.kind === 'none') return '';
  if (s.fog >= 2 || (s.cover === 4 && (s.falling || s.fog > 0)) || s.thunder >= 2) return 'schein';
  if (s.cover === 4) return s.level === 'plain' ? 'schein' : 'hole';
  return s.veil ? 'veil' : 'clear';
}

export interface SceneInput {
  forecast: Forecast;
  /** When the forecast was fetched and the clock now (ms): the place's local time follows from both. */
  at: number;
  nowMs: number;
  lat: number;
  theme: SceneTheme;
  /**
   * The hour row the scene is drawn for (package C passes a chosen one); without it the current values and the
   * hour row of now (amount, CAPE …) are used.
   */
  hour?: SceneHour;
  calm?: boolean;
  level?: SceneLevel;
  motion?: boolean;
  /** The moon now at the place (`core/sky` `moonNow`); absent when "Mond und Himmelsereignisse" is off. */
  moon?: MoonInput;
  /** The sky event now (`core/sky` `skyEvents().scene`); absent when "Mond und Himmelsereignisse" is off. */
  event?: { event: SceneEvent; amount: number };
}

/** What the scene needs of the moon now (a subset of `core/sky` `MoonNow`). */
export interface MoonInput {
  lit: number;
  tilt: number;
  alt: number;
  az: number;
  /** The local day is named full moon / its full moon is a supermoon. */
  full: boolean;
  superMoon: boolean;
}

/** The moon on the picture's arc: east at the left end, south at the top, west at the right (mirrored south). */
export function moonArcT(az: number, lat: number): number {
  // South of the equator one faces north: east on the right, north at the top, west on the left; the break of the
  // scale lies behind the observer (south), as it lies in the north for the northern branch.
  const s180 = ((((az + 180) % 360) + 360) % 360) - 180;
  const t = lat >= 0 ? (az - 90) / 180 : (s180 + 90) / 180;
  return Math.min(1, Math.max(0, t));
}

/** Day moon: by day, moon up, 20–97 % lit, cloud cover ≤ 60 %. */
const DAY_MOON = { min: 0.2, max: 0.97, cloud: 60 } as const;

/** The hour row of a moment (`YYYY-MM-DDTHH:mm`) and the one before it. */
function rowsAround(f: Forecast, iso: string): { now?: SceneHour; prev?: SceneHour } {
  const hours = (f.hours ?? []) as SceneHour[];
  const key = `${iso.slice(0, 13)}:00`;
  const i = hours.findIndex((h) => h.time === key);
  return i < 0 ? {} : { now: hours[i], prev: i > 0 ? hours[i - 1] : undefined };
}

/**
 * The hour row of now as the scene and the head's word read it: now's values over the forecast's hour row of now
 * (amount, CAPE, cloud heights … where the cache has them).
 */
export function sceneHourOf(f: Forecast, nowIso: string): SceneHour {
  const row = rowsAround(f, nowIso).now;
  return {
    ...row,
    time: nowIso,
    temp: f.temp,
    code: f.code,
    group: f.group,
    wind: f.now?.wind ?? row?.wind,
    gust: f.now?.gust ?? row?.gust,
    dir: f.now?.dir ?? row?.dir,
    cloud: f.now?.cloud ?? row?.cloud,
    snowDepth: f.now?.snowDepth ?? row?.snowDepth,
    night: f.now?.night ?? row?.night,
  };
}

/** The picture's state for a forecast (handoff 01b "Model", CONCEPT-MOON §4; round 2: handoff 00 "Scene state"). */
export function sceneOf(i: SceneInput): SceneState {
  const f = i.forecast;
  const nowIso = i.hour?.time ?? placeNowIso(f, i.at, i.nowMs);
  const today = f.days?.find((d) => d.date === nowIso.slice(0, 10));
  const around = rowsAround(f, nowIso);
  // The drawn hour: a chosen row, else now's values over the hour row of now.
  const h: SceneHour = i.hour ?? sceneHourOf(f, nowIso);
  const prev = around.prev;
  const temp = h.temp ?? f.temp;
  const isDay = h.night == null ? true : !h.night;
  const phase = phaseOf(nowIso, today?.sunrise, today?.sunset, isDay);
  const code = h.code;
  const base = condOf(code, h.group ?? f.group);
  const cond = base.cond;
  const thunder = thunderLevel(code ?? (isThunder(cond) ? 95 : undefined), h.mm, h.gust, h.cape);
  // Without a code the amount says the strength; a thunderstorm's rain takes its level (CONCEPT §3).
  let intensity: Intensity =
    code == null && h.mm != null && FALLING.has(cond) ? intensityOfAmount(h.mm) : base.intensity;
  if (thunder) intensity = Math.min(3, thunder) as Intensity;
  const fog = fogLevel(code ?? (cond === 'fog' ? 45 : undefined), h.vis);
  const byDay = phase === 'day' || phase === 'golden';
  let t = 0.5;
  if (today?.sunrise && today.sunset) {
    const sr = minutes(today.sunrise);
    const span = minutes(today.sunset) - sr;
    if (span > 0) t = Math.min(1, Math.max(0, (minutes(nowIso.slice(11, 16)) - sr) / span));
  }
  const cloud = h.cloud ?? CLOUD_DEFAULT[cond];
  let cover = coverOf(h, CLOUD_DEFAULT[cond]);
  // The tower needs sky around it; from level 2 the storm base spans the sky.
  if (thunder === 1) cover = Math.min(cover, 3) as Cover;
  if (thunder >= 2) cover = 4;
  const veil = veilOf(h) && cover < 4;
  const falling = FALLING.has(cond);
  const m = i.moon;
  const moonUp = !!m && m.alt > 0;
  let body: SceneState['body'] = { kind: byDay ? 'sun' : 'none', t };
  if (!byDay && m && moonUp) body = { kind: 'moon', t: moonArcT(m.az, i.lat), alt: m.alt };
  const moon = m
    ? {
        illum: m.lit,
        tilt: m.tilt,
        size: body.kind === 'moon' && m.full ? (m.superMoon ? 1.35 : 1.2) : 1,
        t: moonArcT(m.az, i.lat),
        alt: m.alt,
      }
    : undefined;
  const dayMoon =
    byDay && moonUp && m.lit >= DAY_MOON.min && m.lit <= DAY_MOON.max && cloud <= DAY_MOON.cloud;
  const event = eventOf(i.event?.event, body.kind, phase, cloud);
  // Rainbow: the sun stands behind the viewer, so no disc (handoff 03 "Scene").
  if (event === 'rainbow') body = { kind: 'none', t };
  const snowing = SNOWING.has(cond);
  const snowCover = snowCoverOf(h.snowDepth, snowing ? intensity : 0);
  const level = i.level ?? 'full';
  const sun: Level = byDay && body.kind === 'sun' && !falling && !fog ? sunLevel(h, cover) : 0;
  return {
    phase,
    theme: i.theme,
    cond,
    intensity,
    cloud,
    cover,
    veil,
    sun,
    thunder,
    fog,
    snowCover,
    windTo: windTo(h.dir, i.lat),
    wet: wetOf(falling && !snowing, prev),
    mode: bodyMode({ body, cover, veil, thunder, fog, falling, level }),
    wind: windLevel(h.wind, h.gust),
    frost: frostLevel(temp, cond, code),
    heat: temp >= HEAT_C && byDay,
    season: seasonOf(Number(nowIso.slice(5, 7)), i.lat),
    body,
    moon,
    dayMoon,
    event,
    eventAmount: event ? Math.min(1, Math.max(0, i.event?.amount ?? 0)) : 0,
    calm: !!i.calm,
    level,
    motion: !!i.motion,
    landscape: 'mountains',
    seed: 7,
  };
}

/** Meteor streaks only with cloud cover up to this (CONCEPT-EVENTS §1). */
const METEOR_CLOUD = 60;
/** Aurora curtains only with cloud cover up to this (CONCEPT-SOURCES §2). */
const AURORA_CLOUD = 60;

/**
 * Whether the event can be drawn now (handoff 03 "Scene"): solar events and the rainbow need the sun as the body,
 * lunar events the moon; dust is by day only; meteors, the aurora and the star night only at night (meteors and the
 * aurora with cloud ≤ 60 %; the mockup draws the aurora only in the night phase, not at dusk or dawn).
 */
function eventOf(
  ev: SceneEvent | undefined,
  body: SceneState['body']['kind'],
  phase: Phase,
  cloud: number,
): SceneEvent | undefined {
  if (!ev) return undefined;
  const ok =
    ev === 'solarPartial' || ev === 'solarTotal' || ev === 'solarAnnular' || ev === 'rainbow'
      ? body === 'sun'
      : ev === 'lunarPartial' || ev === 'lunarTotal'
        ? body === 'moon'
        : ev === 'dust'
          ? phase === 'day' || phase === 'golden'
          : ev === 'meteors'
            ? phase === 'night' && cloud <= METEOR_CLOUD
            : ev === 'aurora'
              ? phase === 'night' && cloud <= AURORA_CLOUD
              : phase === 'night';
  return ok ? ev : undefined;
}

/** The calm default (loading, no place): a clear day of the device's season, no body. */
export function defaultScene(theme: SceneTheme, month: number, calm = false): SceneState {
  return {
    phase: 'day',
    theme,
    cond: 'clear',
    intensity: 2,
    cloud: 5,
    cover: 0,
    veil: false,
    sun: 0,
    thunder: 0,
    fog: 0,
    snowCover: 0,
    windTo: 'right',
    wet: false,
    mode: '',
    wind: 0,
    frost: 0,
    heat: false,
    season: seasonOf(month, 47),
    body: { kind: 'none', t: 0.5 },
    eventAmount: 0,
    calm,
    level: 'full',
    motion: false,
    landscape: 'mountains',
    seed: 7,
  };
}

export const isSnow = (c: Cond): boolean => c === 'snow' || c === 'snowShowers';
export const isThunder = (c: Cond): boolean => c === 'thunder' || c === 'thunderHail';
export const isDrizzle = (c: Cond): boolean => c === 'drizzle' || c === 'freezingDrizzle';

/** Skies with their own twilight glow (palette `glow`). */
const GLOW_KEYS: ReadonlySet<SkyKey> = new Set<SkyKey>(['dawn', 'dusk', 'golden']);

/**
 * Which sky (round 2 mockup `skyKey`, CONCEPT §4): grey weather at dawn and dusk takes the night family; thunder level 1
 * the `rain` sky, `storm` from level 2; rain level 1 and drizzle the pale `drizzle` sky, levels 2–3 `rain`; drizzle at
 * night `night-rain`; an overcast night the lighter sky under the deck. `night-full` keeps the full-moon flag.
 */
export function skyOf(s: SceneState): { key: SkyKey; glow?: { phase: Phase; strength: number } } {
  const key = ((): SkyKey => {
    if (s.event === 'solarTotal') return 'eclipse-sky';
    if (s.event === 'dust') return 'dust';
    const c = s.cond;
    const falling = FALLING.has(c);
    const grey = s.cover === 4 || falling || s.fog > 0;
    const p = s.phase;
    if (p === 'night' || ((p === 'dawn' || p === 'dusk') && grey)) {
      if (s.fog) return 'night-fog';
      if (isSnow(c)) return 'night-snow';
      if (falling || s.thunder) return 'night-rain';
      if (s.cover === 4) return 'night-overcast';
      return s.body.kind === 'moon' && (s.moon?.size ?? 1) >= 1.2 ? 'night-full' : 'night';
    }
    if (p === 'dawn' || p === 'dusk') return p;
    if (s.thunder >= 2) return 'storm';
    if (s.fog) return 'fog';
    if (isSnow(c)) return 'snow';
    if (falling) return s.thunder || (s.intensity >= 2 && !isDrizzle(c)) ? 'rain' : 'drizzle';
    if (s.cover === 4) return 'overcast';
    if (p === 'golden') return 'golden';
    return s.heat ? 'heat' : 'day';
  })();
  return GLOW_KEYS.has(key) ? { key, glow: { phase: s.phase, strength: 1 } } : { key };
}

export const skyKey = (s: SceneState): SkyKey => skyOf(s).key;

/** Skies light enough for dark ink: [light theme, dark theme] (A11Y §1); all others take the light ink. */
const DARK_INK: Partial<Record<SkyKey, readonly [boolean, boolean]>> = {
  golden: [true, false],
  day: [true, false],
  overcast: [true, false],
  drizzle: [true, false],
  snow: [true, false],
  fog: [true, false],
  heat: [true, false],
  dust: [true, false],
};

/** The ink of text on a sky in a theme (A11Y §1). */
export const inkForSky = (key: SkyKey, theme: SceneTheme): 'light' | 'dark' =>
  DARK_INK[key]?.[theme === 'dark' ? 1 : 0] ? 'dark' : 'light';

/** The ink of text on the scene; the calm scene takes the theme's own. */
export function inkOf(s: SceneState): 'light' | 'dark' {
  if (s.calm) return s.theme === 'dark' ? 'light' : 'dark';
  return inkForSky(skyKey(s), s.theme);
}

/** Every sky the scene can draw (the contrast test walks them). */
export const SKY_KEYS: readonly SkyKey[] = [
  'night',
  'night-full',
  'night-overcast',
  'night-rain',
  'night-snow',
  'night-fog',
  'dawn',
  'dusk',
  'golden',
  'day',
  'overcast',
  'drizzle',
  'rain',
  'storm',
  'snow',
  'fog',
  'heat',
  'dust',
  'eclipse-sky',
];
