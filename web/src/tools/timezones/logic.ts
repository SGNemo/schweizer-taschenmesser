/** Time zone conversion on top of `Intl` (no tables, DST comes from the platform's tz database). */

import { t } from '@/strings';

export interface Zone {
  id: string;
  label: string;
}

/** Zones offered in the picker (IANA ids; names from the catalog, in the current language). */
export const ZONES: readonly Zone[] = [
  {
    id: 'UTC',
    get label() {
      return t.tools.timezones.zones['UTC'] ?? 'UTC';
    },
  },
  {
    id: 'Europe/Berlin',
    get label() {
      return t.tools.timezones.zones['Europe/Berlin'] ?? 'Europe/Berlin';
    },
  },
  {
    id: 'Europe/London',
    get label() {
      return t.tools.timezones.zones['Europe/London'] ?? 'Europe/London';
    },
  },
  {
    id: 'Europe/Lisbon',
    get label() {
      return t.tools.timezones.zones['Europe/Lisbon'] ?? 'Europe/Lisbon';
    },
  },
  {
    id: 'Europe/Athens',
    get label() {
      return t.tools.timezones.zones['Europe/Athens'] ?? 'Europe/Athens';
    },
  },
  {
    id: 'Europe/Istanbul',
    get label() {
      return t.tools.timezones.zones['Europe/Istanbul'] ?? 'Europe/Istanbul';
    },
  },
  {
    id: 'Europe/Moscow',
    get label() {
      return t.tools.timezones.zones['Europe/Moscow'] ?? 'Europe/Moscow';
    },
  },
  {
    id: 'Africa/Lagos',
    get label() {
      return t.tools.timezones.zones['Africa/Lagos'] ?? 'Africa/Lagos';
    },
  },
  {
    id: 'Africa/Cairo',
    get label() {
      return t.tools.timezones.zones['Africa/Cairo'] ?? 'Africa/Cairo';
    },
  },
  {
    id: 'Africa/Nairobi',
    get label() {
      return t.tools.timezones.zones['Africa/Nairobi'] ?? 'Africa/Nairobi';
    },
  },
  {
    id: 'Africa/Johannesburg',
    get label() {
      return t.tools.timezones.zones['Africa/Johannesburg'] ?? 'Africa/Johannesburg';
    },
  },
  {
    id: 'Asia/Dubai',
    get label() {
      return t.tools.timezones.zones['Asia/Dubai'] ?? 'Asia/Dubai';
    },
  },
  {
    id: 'Asia/Kolkata',
    get label() {
      return t.tools.timezones.zones['Asia/Kolkata'] ?? 'Asia/Kolkata';
    },
  },
  {
    id: 'Asia/Bangkok',
    get label() {
      return t.tools.timezones.zones['Asia/Bangkok'] ?? 'Asia/Bangkok';
    },
  },
  {
    id: 'Asia/Singapore',
    get label() {
      return t.tools.timezones.zones['Asia/Singapore'] ?? 'Asia/Singapore';
    },
  },
  {
    id: 'Asia/Shanghai',
    get label() {
      return t.tools.timezones.zones['Asia/Shanghai'] ?? 'Asia/Shanghai';
    },
  },
  {
    id: 'Asia/Tokyo',
    get label() {
      return t.tools.timezones.zones['Asia/Tokyo'] ?? 'Asia/Tokyo';
    },
  },
  {
    id: 'Asia/Seoul',
    get label() {
      return t.tools.timezones.zones['Asia/Seoul'] ?? 'Asia/Seoul';
    },
  },
  {
    id: 'Australia/Sydney',
    get label() {
      return t.tools.timezones.zones['Australia/Sydney'] ?? 'Australia/Sydney';
    },
  },
  {
    id: 'Pacific/Auckland',
    get label() {
      return t.tools.timezones.zones['Pacific/Auckland'] ?? 'Pacific/Auckland';
    },
  },
  {
    id: 'Pacific/Honolulu',
    get label() {
      return t.tools.timezones.zones['Pacific/Honolulu'] ?? 'Pacific/Honolulu';
    },
  },
  {
    id: 'America/Anchorage',
    get label() {
      return t.tools.timezones.zones['America/Anchorage'] ?? 'America/Anchorage';
    },
  },
  {
    id: 'America/Los_Angeles',
    get label() {
      return t.tools.timezones.zones['America/Los_Angeles'] ?? 'America/Los_Angeles';
    },
  },
  {
    id: 'America/Denver',
    get label() {
      return t.tools.timezones.zones['America/Denver'] ?? 'America/Denver';
    },
  },
  {
    id: 'America/Chicago',
    get label() {
      return t.tools.timezones.zones['America/Chicago'] ?? 'America/Chicago';
    },
  },
  {
    id: 'America/Mexico_City',
    get label() {
      return t.tools.timezones.zones['America/Mexico_City'] ?? 'America/Mexico_City';
    },
  },
  {
    id: 'America/New_York',
    get label() {
      return t.tools.timezones.zones['America/New_York'] ?? 'America/New_York';
    },
  },
  {
    id: 'America/Sao_Paulo',
    get label() {
      return t.tools.timezones.zones['America/Sao_Paulo'] ?? 'America/Sao_Paulo';
    },
  },
  {
    id: 'America/Argentina/Buenos_Aires',
    get label() {
      return (
        t.tools.timezones.zones['America/Argentina/Buenos_Aires'] ??
        'America/Argentina/Buenos_Aires'
      );
    },
  },
];

export const zoneLabel = (id: string): string => ZONES.find((z) => z.id === id)?.label ?? id;

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(zone, f);
  }
  return f;
}

/** Whether the platform knows the zone id. */
export function isKnownZone(zone: string): boolean {
  try {
    formatter(zone);
    return true;
  } catch {
    return false;
  }
}

interface Wall {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
}

function wallTime(ms: number, zone: string): Wall {
  const parts = Object.fromEntries(
    formatter(zone)
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  return {
    y: +parts.year!,
    mo: +parts.month!,
    d: +parts.day!,
    h: +parts.hour! % 24,
    mi: +parts.minute!,
  };
}

/** Offset of `zone` from UTC at the instant `ms`, in minutes (Berlin in summer: 120). */
export function offsetMinutes(ms: number, zone: string): number {
  const w = wallTime(Math.floor(ms / 60_000) * 60_000, zone);
  const asUtc = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi);
  return Math.round((asUtc - Math.floor(ms / 60_000) * 60_000) / 60_000);
}

/** `UTC+5:30`, `UTC−4`, `UTC`. */
export function offsetLabel(minutes: number): string {
  if (minutes === 0) return 'UTC';
  const sign = minutes > 0 ? '+' : '−';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

/**
 * The instant at which the wall clock in `zone` shows `date` (`YYYY-MM-DD`) and `time` (`HH:mm`).
 * A time skipped by the switch to summer time is moved forward; a repeated one takes its first
 * occurrence. `undefined` for invalid input.
 */
export function zonedInstant(date: string, time: string, zone: string): number | undefined {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dm || !tm || !isKnownZone(zone)) return undefined;
  const [y, mo, d, h, mi] = [+dm[1]!, +dm[2]!, +dm[3]!, +tm[1]!, +tm[2]!];
  if (mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59) return undefined;
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  if (new Date(guess).getUTCDate() !== d) return undefined; // 30 February and friends
  // Try both offsets around the guess; prefer the earlier instant that maps back to the wall time.
  const candidates = new Set([
    guess - offsetMinutes(guess, zone) * 60_000,
    guess - offsetMinutes(guess - 86_400_000, zone) * 60_000,
    guess - offsetMinutes(guess + 86_400_000, zone) * 60_000,
  ]);
  const valid = [...candidates].filter((ms) => {
    const w = wallTime(ms, zone);
    return w.y === y && w.mo === mo && w.d === d && w.h === h && w.mi === mi;
  });
  if (valid.length) return Math.min(...valid);
  // In the gap: use the offset from before the switch, which lands on the later wall time.
  return guess - offsetMinutes(guess - 86_400_000, zone) * 60_000;
}

export interface Shown {
  date: string;
  time: string;
  offset: string;
  /** Calendar days between the shown date and the date in the reference zone. */
  dayDiff: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Wall time of `instant` in `zone`, with the day difference to `refZone`. */
export function showIn(instant: number, zone: string, refZone: string): Shown {
  const w = wallTime(instant, zone);
  const r = wallTime(instant, refZone);
  const dayDiff = Math.round(
    (Date.UTC(w.y, w.mo - 1, w.d) - Date.UTC(r.y, r.mo - 1, r.d)) / 86_400_000,
  );
  return {
    date: `${w.y}-${pad(w.mo)}-${pad(w.d)}`,
    time: `${pad(w.h)}:${pad(w.mi)}`,
    offset: offsetLabel(offsetMinutes(instant, zone)),
    dayDiff,
  };
}
