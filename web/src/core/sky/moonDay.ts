/**
 * The moon of a place's local day and of now (CONCEPT-MOON §2–§5): name by rule (ii), lit fraction, rise and set,
 * next full and new moon, supermoon, second full moon in the month. Local days follow the place's IANA zone
 * (`Forecast.tz`, 23 / 25 h on a clock change); without one, the device's zone. Pure apart from a small memo per place
 * and day; position and time never leave the device.
 */
import { moonPhase } from './core';
import { phaseNameForDay, type PhaseName } from './phaseName';
import { phasesBetween, type PhaseInstant } from './phases';
import { moonRiseSet } from './riseset';
import { crescentTilt } from './topo';

/** A full moon at or below this distance is a supermoon (CONCEPT-MOON §5). */
export const SUPERMOON_KM = 361885;
const DAY = 86400000;

const dtf = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string | undefined): Intl.DateTimeFormat {
  const key = tz ?? '';
  let f = dtf.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    dtf.set(key, f);
  }
  return f;
}

/** The zone's wall clock at an instant, as if it were UTC (ms). */
function wallMs(ms: number, tz: string | undefined): number {
  const p: Record<string, number> = {};
  for (const part of formatter(tz).formatToParts(ms))
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour! % 24, p.minute!, p.second!);
}

/** `YYYY-MM-DD` of an instant in the zone. */
export function localDate(ms: number, tz?: string): string {
  return new Date(wallMs(ms, tz)).toISOString().slice(0, 10);
}

/** The instant of local midnight at the start of `date` in the zone. */
export function localMidnight(date: string, tz?: string): number {
  const wall = Date.parse(`${date}T00:00:00Z`);
  let ms = wall;
  // Two corrections settle the offset, also across a clock change.
  for (let i = 0; i < 3; i++) ms = wall - (wallMs(ms, tz) - ms);
  return ms;
}

const nextDate = (date: string): string =>
  new Date(Date.parse(`${date}T12:00:00Z`) + DAY).toISOString().slice(0, 10);

/** Bounds of the local day `date`: [start, end). */
export function dayBounds(date: string, tz?: string): { start: number; end: number } {
  return { start: localMidnight(date, tz), end: localMidnight(nextDate(date), tz) };
}

export interface MoonDay {
  date: string;
  name: PhaseName;
  /** Illuminated fraction at the day's middle, 0…1. */
  lit: number;
  waxing: boolean;
  /** Moonrise and moonset inside the local day (ms), null when there is none; calculated on first read. */
  readonly rise: number | null;
  readonly set: number | null;
  /** Next full / new moon instant from the day's start on (today's if it falls on this day). */
  nextFull: number;
  nextNew: number;
  /** The day's full moon is close to the Earth (≤ 361 885 km). */
  superMoon: boolean;
  /** The day's full moon is the second in the place's calendar month. */
  secondFull: boolean;
}

const memo = new Map<string, MoonDay>();
const MEMO_MAX = 64;

/** The moon of one local day at a place. */
export function moonOfDay(date: string, lat: number, lon: number, tz?: string): MoonDay {
  const key = `${lat},${lon},${tz ?? ''},${date}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const { start, end } = dayBounds(date, tz);
  // Principal phases from a little before the month's start to well after the day: names, next phases, second full.
  const monthStart = localMidnight(`${date.slice(0, 8)}01`, tz);
  const principal: PhaseInstant[] = phasesBetween(
    Math.min(monthStart, start) - 2 * DAY,
    end + 40 * DAY,
  );
  const name = phaseNameForDay(start, end, principal);
  const mid = moonPhase((start + end) / 2);
  const fullToday = principal.find((p) => p.phase === 2 && p.ms >= start && p.ms < end);
  const nextFull = principal.find((p) => p.phase === 2 && p.ms >= start)!.ms;
  const nextNew = principal.find((p) => p.phase === 0 && p.ms >= start)!.ms;
  const secondFull =
    !!fullToday &&
    principal.some((p) => p.phase === 2 && p.ms >= monthStart && p.ms < fullToday.ms);
  let riseSet: { rise: number | null; set: number | null } | undefined;
  const rs = () => (riseSet ??= moonRiseSet(start, end, lat, lon));
  const day: MoonDay = {
    date,
    name,
    lit: mid.k,
    waxing: mid.waxing,
    get rise() {
      return rs().rise;
    },
    get set() {
      return rs().set;
    },
    nextFull,
    nextNew,
    superMoon: !!fullToday && moonPhase(fullToday.ms).distKm <= SUPERMOON_KM,
    secondFull,
  };
  if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value!);
  memo.set(key, day);
  return day;
}

export interface MoonNow {
  /** The name of the place's current local day. */
  name: PhaseName;
  /** Illuminated fraction now. */
  lit: number;
  waxing: boolean;
  /** Direction of the lit side against "up", deg (+ = left); meaningful for 3–97 % lit. */
  tilt: number;
  /** Geometric altitude and azimuth of the moon and the sun's altitude, deg. */
  alt: number;
  az: number;
  sunAlt: number;
  day: MoonDay;
}

/** The moon now at a place (the real instant, not the forecast's slot). */
export function moonNow(ms: number, lat: number, lon: number, tz?: string): MoonNow {
  const day = moonOfDay(localDate(ms, tz), lat, lon, tz);
  const p = moonPhase(ms);
  const t = crescentTilt(ms, lat, lon);
  return {
    name: day.name,
    lit: p.k,
    waxing: p.waxing,
    tilt: t.tilt,
    alt: t.sky.moon.alt,
    az: t.sky.moon.az,
    sunAlt: t.sky.sun.alt,
    day,
  };
}
