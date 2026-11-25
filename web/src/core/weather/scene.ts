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
  wind: Level;
  /** 0 none, 1 at 0° and below with nothing falling (and rime fog), 2 at −5° and below. */
  frost: 0 | 1 | 2;
  heat: boolean;
  snowGround: boolean;
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

export interface SceneInput {
  forecast: Forecast;
  /** When the forecast was fetched and the clock now (ms): the place's local time follows from both. */
  at: number;
  nowMs: number;
  lat: number;
  theme: SceneTheme;
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

/** The picture's state for a forecast (handoff 01b "Model", CONCEPT-MOON §4). */
export function sceneOf(i: SceneInput): SceneState {
  const f = i.forecast;
  const nowIso = placeNowIso(f, i.at, i.nowMs);
  const today = f.days?.find((d) => d.date === nowIso.slice(0, 10));
  const isDay = f.now?.night == null ? true : !f.now.night;
  const phase = phaseOf(nowIso, today?.sunrise, today?.sunset, isDay);
  const { cond, intensity } = condOf(f.code, f.group);
  const byDay = phase === 'day' || phase === 'golden';
  let t = 0.5;
  if (today?.sunrise && today.sunset) {
    const sr = minutes(today.sunrise);
    const span = minutes(today.sunset) - sr;
    if (span > 0) t = Math.min(1, Math.max(0, (minutes(nowIso.slice(11, 16)) - sr) / span));
  }
  const cloud = f.now?.cloud ?? CLOUD_DEFAULT[cond];
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
  return {
    phase,
    theme: i.theme,
    cond,
    intensity,
    cloud,
    wind: windLevel(f.now?.wind, f.now?.gust),
    frost: frostLevel(f.temp, cond, f.code),
    heat: f.temp >= HEAT_C && byDay,
    snowGround: SNOWING.has(cond) || (f.now?.snowDepth ?? 0) >= SNOW_LIES_M,
    season: seasonOf(Number(nowIso.slice(5, 7)), i.lat),
    body,
    moon,
    dayMoon,
    event,
    eventAmount: event ? Math.min(1, Math.max(0, i.event?.amount ?? 0)) : 0,
    calm: !!i.calm,
    level: i.level ?? 'full',
    motion: !!i.motion,
    landscape: 'mountains',
    seed: 7,
  };
}

/** Meteor streaks only with cloud cover up to this (CONCEPT-EVENTS §1). */
const METEOR_CLOUD = 60;

/**
 * Whether the event can be drawn now (handoff 03 "Scene"): solar events and the rainbow need the sun as the body,
 * lunar events the moon; dust is by day only; meteors and the star night only at night (meteors with cloud ≤ 60 %).
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
    wind: 0,
    frost: 0,
    heat: false,
    snowGround: false,
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

const OPEN: ReadonlySet<Cond> = new Set<Cond>(['clear', 'mostlyClear', 'partly']);
export const isSnow = (c: Cond): boolean => c === 'snow' || c === 'snowShowers';
export const isThunder = (c: Cond): boolean => c === 'thunder' || c === 'thunderHail';
export const isDrizzle = (c: Cond): boolean => c === 'drizzle' || c === 'freezingDrizzle';

/** Which sky (mockup `skyOf`): the family by condition, the twilight glow at full or 40 % strength. */
export function skyOf(s: SceneState): { key: SkyKey; glow?: { phase: Phase; strength: number } } {
  if (s.event === 'solarTotal') return { key: 'eclipse-sky' };
  if (s.event === 'dust') return { key: 'dust' };
  const c = s.cond;
  const deck = s.cloud > 85 && c !== 'fog';
  const nightKey = (): SkyKey => {
    if (c === 'fog') return 'night-fog';
    if (isSnow(c)) return 'night-snow';
    if (c === 'rain' || c === 'freezingRain' || c === 'showers' || isThunder(c))
      return 'night-rain';
    if (c === 'overcast' || isDrizzle(c) || deck) return 'night-overcast';
    return s.body.kind === 'moon' && (s.moon?.size ?? 1) >= 1.2 ? 'night-full' : 'night';
  };
  const dayKey = (): SkyKey => {
    if (c === 'fog') return 'fog';
    if (isSnow(c)) return 'snow';
    if (isThunder(c)) return 'storm';
    if (c === 'rain' || c === 'freezingRain') return 'rain';
    if (isDrizzle(c) || c === 'showers') return 'drizzle';
    if (c === 'overcast' || deck) return 'overcast';
    return s.heat ? 'heat' : 'day';
  };
  const p = s.phase;
  if (p === 'night') return { key: nightKey() };
  if (p === 'day') return { key: dayKey() };
  if (OPEN.has(c) && !deck && !FALLING.has(c)) return { key: p, glow: { phase: p, strength: 1 } };
  return { key: p === 'golden' ? dayKey() : nightKey(), glow: { phase: p, strength: 0.4 } };
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
