/**
 * Sky events of a place and an instant, one at a time (CONCEPT-EVENTS §2): what the scene draws, the hero's chip,
 * the card's "Als Nächstes" and whether the stage carries the eclipse safety pill. Pure; everything is calculated
 * on the device from position and time (and the forecast already fetched), nothing asks the network.
 */
import { moonPhase } from './core';
import {
  localLunarEclipse,
  lunarEclipsesBetween,
  type LocalLunarEclipse,
  umbraAt,
} from './lunarEclipses';
import { showerNight, type ShowerNight } from './meteors';
import { dayBounds, localDate } from './moonDay';
import { seasonInstant } from './phases';
import {
  centralAt,
  localSolarEclipses,
  obscurationAt,
  SOLAR_MIN,
  type LocalSolarEclipse,
} from './solarEclipse';
import { sky } from './topo';

export type SceneEvent =
  | 'solarPartial'
  | 'solarTotal'
  | 'solarAnnular'
  | 'lunarPartial'
  | 'lunarTotal'
  | 'meteors'
  | 'starNight'
  | 'rainbow'
  | 'dust';

export type SeasonKind = 'equinoxSpring' | 'solsticeSummer' | 'equinoxAutumn' | 'solsticeWinter';

/** Today, later today, or within the coming 7 days. */
export type When = 'running' | 'today' | 'ahead';

export type EventChip =
  | { kind: 'solar' | 'lunar'; from: number; to: number }
  | { kind: 'rainbow' }
  | { kind: 'meteors'; night: ShowerNight };

export type CardEvent =
  | { kind: 'solar'; when: When; eclipse: LocalSolarEclipse; clouds: boolean }
  | { kind: 'lunar'; when: When; eclipse: LocalLunarEclipse; clouds: boolean }
  | { kind: 'meteors'; night: ShowerNight; moonBright: boolean; clouds: boolean }
  | { kind: 'rainbow' }
  | { kind: 'season'; season: SeasonKind; at: number }
  | { kind: 'starNight' };

export interface SkyEvents {
  scene?: { event: SceneEvent; amount: number };
  chip?: EventChip;
  card?: CardEvent;
  /** The day of a visible solar eclipse, until its end: the safety sentence stands in the stage. */
  safety: boolean;
}

export interface EventsInput {
  nowMs: number;
  lat: number;
  lon: number;
  /** The place's IANA zone; local days follow it. */
  tz?: string;
  /** WMO code and cloud cover (percent) now. */
  code?: number;
  cloud?: number;
  /** Hourly cloud cover at the place's local `YYYY-MM-DDTHH:mm`, as far as the forecast reaches. */
  hours?: readonly { time: string; cloud?: number }[];
  /** Mineral dust now, µg/m³. */
  dust?: number;
}

const DAY = 86400000;
const AHEAD = 7 * DAY;
/** Rainbow weather: rain or showers now (CONCEPT-EVENTS §1). */
export const RAINBOW_CODES: ReadonlySet<number> = new Set([61, 80, 81, 82]);
export const RAINBOW_SUN = [3, 40] as const;
export const RAINBOW_CLOUD_MAX = 85;
export const STAR_CLOUD_MAX = 20;
export const STAR_MOON_LIT_MAX = 0.1;
export const METEOR_CLOUD_MAX = 60;
export const METEOR_MOON_LIT = 0.6;
export const CLOUDS_HIDE = 80;
export const DUST_MIN = 50;
/** Darker than this (sun's altitude, deg) counts as night for meteors and the star night. */
const DARK = -12;

/** The place's local `YYYY-MM-DDTHH:00` of an instant, to find its forecast hour. */
function localHour(ms: number, tz?: string): string {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
  }).formatToParts(ms);
  const p = Object.fromEntries(f.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:00`;
}

/** Cloud cover at an instant from the hourly forecast; undefined beyond it. */
export function cloudAt(ms: number, hours: EventsInput['hours'], tz?: string): number | undefined {
  if (!hours) return undefined;
  const key = localHour(ms, tz);
  return hours.find((h) => h.time.slice(0, 13) === key.slice(0, 13))?.cloud;
}

/** The solstice or equinox on a local day, named for the hemisphere (swapped south of the equator). */
export function seasonOn(
  date: string,
  lat: number,
  tz?: string,
): { season: SeasonKind; at: number } | null {
  const year = Number(date.slice(0, 4));
  const north: SeasonKind[] = [
    'equinoxSpring',
    'solsticeSummer',
    'equinoxAutumn',
    'solsticeWinter',
  ];
  const south: SeasonKind[] = [
    'equinoxAutumn',
    'solsticeWinter',
    'equinoxSpring',
    'solsticeSummer',
  ];
  for (const which of [0, 1, 2, 3] as const) {
    const at = seasonInstant(year, which);
    if (localDate(at, tz) === date) return { season: (lat < 0 ? south : north)[which]!, at };
  }
  return null;
}

/** The visible part of a solar eclipse: from sunrise or begin to sunset or end. */
export function solarSpan(e: LocalSolarEclipse): { from: number; to: number } {
  return {
    from: Math.max(e.begin, e.sunRise ?? -Infinity),
    to: Math.min(e.end, e.sunSet ?? Infinity),
  };
}

interface Found {
  solar: LocalSolarEclipse[];
  lunar: LocalLunarEclipse[];
}

const memo = new Map<string, Found>();

/** The shown eclipses touching [today's start − 1 day, now + 8 days), memoised per place and local day. */
function eclipses(nowMs: number, lat: number, lon: number, tz?: string): Found {
  const today = localDate(nowMs, tz);
  const key = `${lat},${lon},${tz ?? ''},${today}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const { start } = dayBounds(today, tz);
  const from = start - DAY;
  const to = start + AHEAD + 2 * DAY;
  const solar = localSolarEclipses(from, to, lat, lon).filter(
    (e) => e.visibleObscuration >= SOLAR_MIN,
  );
  const lunar = lunarEclipsesBetween(from, to)
    .map((r) => localLunarEclipse(r, lat, lon))
    .filter((e) => e.visible);
  const found = { solar, lunar };
  if (memo.size >= 32) memo.delete(memo.keys().next().value!);
  memo.set(key, found);
  return found;
}

/** All of it for one place and instant. */
export function eventsFor(input: EventsInput): SkyEvents {
  const { nowMs: now, lat, lon, tz } = input;
  const today = localDate(now, tz);
  const { start: dayStart, end: dayEnd } = dayBounds(today, tz);
  const s = sky(now, lat, lon, 15);
  const sunAlt = s.sun.alt;
  const { solar, lunar } = eclipses(now, lat, lon, tz);
  const out: SkyEvents = { safety: false };

  // Eclipses: running, later today, within 7 days.
  type E =
    | { kind: 'solar'; e: LocalSolarEclipse; from: number; to: number; at: number }
    | { kind: 'lunar'; e: LocalLunarEclipse; from: number; to: number; at: number };
  const all: E[] = [
    ...solar.map((e) => ({ kind: 'solar' as const, e, ...solarSpan(e), at: e.peak })),
    ...lunar.map((e) => ({
      kind: 'lunar' as const,
      e,
      from: e.row.u1,
      to: e.row.u4,
      at: e.row.peak,
    })),
  ]
    // Within 7 days counts in local days: on 26 July the eclipse of 2 August is "next".
    .filter((x) => x.to > now && x.from < dayStart + AHEAD + DAY)
    .sort((a, b) => a.from - b.from);
  const whenOf = (x: E): When => (x.from <= now ? 'running' : x.from < dayEnd ? 'today' : 'ahead');
  const cloudy = (ms: number) => (cloudAt(ms, input.hours, tz) ?? 0) > CLOUDS_HIDE;

  for (const x of all) {
    if (x.kind === 'solar' && x.from < dayEnd && x.to >= dayStart) out.safety = true;
  }

  const running = all.find((x) => whenOf(x) === 'running');
  if (running?.kind === 'solar') {
    const amount = obscurationAt(now, lat, lon);
    const central = centralAt(now, lat, lon);
    const event: SceneEvent =
      central && running.e.kind === 'total'
        ? 'solarTotal'
        : central && running.e.kind === 'annular'
          ? 'solarAnnular'
          : 'solarPartial';
    if (sunAlt > 0 && amount > 0) out.scene = { event, amount };
  } else if (running?.kind === 'lunar') {
    const amount = umbraAt(now, running.e.row);
    const total =
      running.e.row.u2 !== undefined && now >= running.e.row.u2 && now <= running.e.row.u3!;
    if (s.moon.alt > 0 && amount > 0)
      out.scene = { event: total ? 'lunarTotal' : 'lunarPartial', amount };
  }

  const rainbow =
    input.code !== undefined &&
    RAINBOW_CODES.has(input.code) &&
    sunAlt >= RAINBOW_SUN[0] &&
    sunAlt <= RAINBOW_SUN[1] &&
    (input.cloud ?? 100) <= RAINBOW_CLOUD_MAX;

  // Meteors: tonight's shower, or last night's while that night lasts.
  const yesterday = localDate(dayStart - DAY / 2, tz);
  const meteorNight = (() => {
    const last = showerNight(yesterday, lat, lon, tz);
    if (last && now <= last.to) return last;
    const tonight = showerNight(today, lat, lon, tz);
    // "That evening and night": from sunset of the day on.
    if (tonight && now >= (dayStart + dayEnd) / 2 && sunAlt < 0 && now <= tonight.to)
      return tonight;
    return null;
  })();

  const dark = sunAlt < DARK;
  const moonLit = s.moon.alt > 0 ? phaseLit(now) : 0;

  // Scene: running eclipse → rainbow → meteors (dark, not too cloudy) → dust (by day) → star night.
  if (!out.scene) {
    if (rainbow) out.scene = { event: 'rainbow', amount: 1 };
    else if (
      meteorNight &&
      dark &&
      now >= meteorNight.from &&
      (input.cloud ?? 0) <= METEOR_CLOUD_MAX
    )
      out.scene = { event: 'meteors', amount: 1 };
    else if ((input.dust ?? 0) >= DUST_MIN && sunAlt > 0) out.scene = { event: 'dust', amount: 1 };
    else if (
      dark &&
      input.cloud !== undefined &&
      input.cloud <= STAR_CLOUD_MAX &&
      (s.moon.alt <= 0 || moonLit < STAR_MOON_LIT_MAX)
    )
      out.scene = { event: 'starNight', amount: 1 };
  }

  // Chip: running eclipse → rainbow → an eclipse later today → meteors tonight.
  const laterToday = all.find((x) => whenOf(x) === 'today');
  if (running) out.chip = { kind: running.kind, from: running.from, to: running.to };
  else if (rainbow) out.chip = { kind: 'rainbow' };
  else if (laterToday)
    out.chip = { kind: laterToday.kind, from: laterToday.from, to: laterToday.to };
  else if (meteorNight) out.chip = { kind: 'meteors', night: meteorNight };

  // Card: the nearest eclipse within 7 days, else today's event.
  const next = all[0];
  if (next) {
    const clouds = cloudy(next.at);
    out.card =
      next.kind === 'solar'
        ? { kind: 'solar', when: whenOf(next), eclipse: next.e, clouds }
        : { kind: 'lunar', when: whenOf(next), eclipse: next.e, clouds };
  } else if (meteorNight) {
    const mid = (meteorNight.from + meteorNight.to) / 2;
    const m = sky(mid, lat, lon, 15).moon;
    out.card = {
      kind: 'meteors',
      night: meteorNight,
      moonBright: m.alt > 0 && phaseLit(mid) > METEOR_MOON_LIT,
      clouds: (cloudAt(mid, input.hours, tz) ?? 0) > METEOR_CLOUD_MAX,
    };
  } else if (rainbow) out.card = { kind: 'rainbow' };
  else {
    const season = seasonOn(today, lat, tz);
    if (season) out.card = { kind: 'season', ...season };
    else if (out.scene?.event === 'starNight') out.card = { kind: 'starNight' };
  }
  return out;
}

const phaseLit = (ms: number): number => moonPhase(ms, 15).k;
