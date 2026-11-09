/**
 * Time zone arithmetic on top of `Intl` (no tables: DST comes from the platform's tz database). Shared by the
 * Uhr module and the Zeitzonen tool; pure, every function takes the instant as an argument (`now()` is the caller's).
 */

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

export interface Wall {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
}

export function wallTime(ms: number, zone: string): Wall {
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
