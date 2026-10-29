import type { CaptureRecurrence } from './types';
import { NUM_SRC, take, toNumber, word, type Scan } from './util';

export const WEEKDAYS: Record<string, number> = {
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
  sonnabend: 6,
  sonntag: 7,
};
export const WEEKDAY_SRC = Object.keys(WEEKDAYS).join('|');

const UNIT: Record<string, CaptureRecurrence['freq']> = {
  tage: 'daily',
  wochen: 'weekly',
  monate: 'monthly',
  jahre: 'yearly',
};

const RULES: { re: RegExp; make: (m: RegExpExecArray) => CaptureRecurrence }[] = [
  {
    re: word(String.raw`alle\s+(\d{1,3}|${NUM_SRC})\s+(tage|wochen|monate|jahre)`),
    make: (m) => ({ freq: UNIT[m[2]!.toLowerCase()]!, interval: toNumber(m[1]!) }),
  },
  {
    re: word(String.raw`jeden\s+monat\s+(?:am\s+)?(\d{1,2})\.`),
    make: (m) => ({ freq: 'monthly', interval: 1, byMonthDay: Number(m[1]) }),
  },
  {
    re: word(String.raw`(?:jeden|an\s+jedem)\s+letzten(?:\s+tag)?(?:\s+(?:des\s+)?monats)?`),
    make: () => ({ freq: 'monthly', interval: 1, byMonthDay: -1 }),
  },
  {
    re: word(String.raw`(?:jeden|an\s+jedem)\s+(\d{1,2})\.(?:\s+(?:des\s+)?monats)?`),
    make: (m) => ({ freq: 'monthly', interval: 1, byMonthDay: Number(m[1]) }),
  },
  {
    re: word(String.raw`jeden\s+(${WEEKDAY_SRC})`),
    make: (m) => ({ freq: 'weekly', interval: 1, byWeekday: [WEEKDAYS[m[1]!.toLowerCase()]!] }),
  },
  {
    re: word(String.raw`(${WEEKDAY_SRC})s`),
    make: (m) => ({ freq: 'weekly', interval: 1, byWeekday: [WEEKDAYS[m[1]!.toLowerCase()]!] }),
  },
  {
    re: word(String.raw`jeden\s+tag|täglich|tagtäglich`),
    make: () => ({ freq: 'daily', interval: 1 }),
  },
  { re: word(String.raw`jede\s+woche|wöchentlich`), make: () => ({ freq: 'weekly', interval: 1 }) },
  {
    re: word(String.raw`vierteljährlich|quartalsweise`),
    make: () => ({ freq: 'monthly', interval: 3 }),
  },
  { re: word(String.raw`halbjährlich`), make: () => ({ freq: 'monthly', interval: 6 }) },
  {
    re: word(String.raw`jeden\s+monat|monatlich|(?:im|pro)\s+monat`),
    make: () => ({ freq: 'monthly', interval: 1 }),
  },
  {
    re: word(String.raw`jedes\s+jahr|jährlich|(?:im|pro)\s+jahr`),
    make: () => ({ freq: 'yearly', interval: 1 }),
  },
];

const ABBR: Record<string, number> = { mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6, so: 7 };
const FULL_SRC = `(?:${WEEKDAY_SRC})s?`;
const TOKEN_SRC = `${FULL_SRC}|(?:mo|di|mi|do|fr|sa|so)\\.?`;
const SET_RE = new RegExp(
  `(?<![\\p{L}\\d])(jeden\\s+)?(${TOKEN_SRC})(?:\\s*(?:–|—|-|bis)\\s*(${TOKEN_SRC})|((?:\\s*(?:,|und|&|/)\\s*(?:${TOKEN_SRC}))+))?(?![\\p{L}\\d])`,
  'giu',
);

/** "mittwochs" → 3, "Mi." → 3; abbreviations are flagged because "so" or "do" are also plain words. */
function weekdayOf(token: string): { day: number; abbr: boolean } | undefined {
  const t = token.toLowerCase().replace(/\.$/, '');
  if (ABBR[t] && t.length === 2) return { day: ABBR[t], abbr: true };
  const day = WEEKDAYS[t] ?? WEEKDAYS[t.slice(0, -1)];
  return day ? { day, abbr: false } : undefined;
}

/**
 * Weekday sets: "Mo–Fr", "Mo und Mi", "Montag bis Freitag", "jeden Montag und Mittwoch", "montags".
 * A lone weekday only counts with "jeden", the plural form or `single` (after "alle 2 Wochen"), and
 * abbreviations only inside a range or list: "so" and "do" are ordinary words.
 */
function weekdaysOf(m: RegExpExecArray, single: boolean): number[] | undefined {
  const first = weekdayOf(m[2]!);
  if (!first) return undefined;
  if (m[3]) {
    const last = weekdayOf(m[3]);
    if (!last) return undefined;
    const days: number[] = [];
    for (let d = first.day; ; d = (d % 7) + 1) {
      days.push(d);
      if (d === last.day || days.length === 7) break;
    }
    return days.length < 2 ? undefined : days;
  }
  if (m[4]) {
    const rest = m[4]
      .split(/\s*(?:,|und|&|\/)\s*/)
      .filter(Boolean)
      .map(weekdayOf);
    if (rest.some((x) => !x)) return undefined;
    const days = [...new Set([first.day, ...rest.map((x) => x!.day)])].sort((a, b) => a - b);
    return days.length < 2 ? undefined : days;
  }
  const plural = !first.abbr && /s$/i.test(m[2]!) && !WEEKDAYS[m[2]!.toLowerCase()];
  return first.abbr || !(m[1] || plural || single) ? undefined : [first.day];
}

function takeWeekdaySet(s: Scan, single: boolean): number[] | undefined {
  SET_RE.lastIndex = 0;
  for (const m of s.t.matchAll(SET_RE)) {
    const days = weekdaysOf(m, single);
    if (!days) continue;
    s.t = `${s.t.slice(0, m.index)} ${s.t.slice(m.index + m[0].length)}`;
    return days;
  }
  return undefined;
}

const INTERVAL_RE = word(String.raw`alle\s+(\d{1,3}|${NUM_SRC})\s+(tage|wochen|monate|jahre)`);

/** Extracts one recurrence phrase ("jede Woche", "jeden 1.", "alle 2 Wochen", "montags", "Mo–Fr"). */
export function extractRecurrence(s: Scan): CaptureRecurrence | undefined {
  // "alle 2 Wochen Mo–Fr", "Mo–Fr alle 2 Wochen", "alle zwei Wochen Mittwoch": interval + weekdays
  const start = s.t;
  const iv = take(s, INTERVAL_RE);
  const interval = iv ? { freq: UNIT[iv[2]!.toLowerCase()]!, n: toNumber(iv[1]!) } : undefined;
  if (!interval || interval.freq === 'weekly') {
    const days = takeWeekdaySet(s, !!interval);
    if (days) return { freq: 'weekly', interval: interval?.n ?? 1, byWeekday: days };
  }
  s.t = start;
  return extractSimple(s);
}

function extractSimple(s: Scan): CaptureRecurrence | undefined {
  for (const rule of RULES) {
    const before = s.t;
    const m = take(s, rule.re);
    if (!m) continue;
    const rec = rule.make(m);
    if (
      rec.byMonthDay !== undefined &&
      rec.byMonthDay !== -1 &&
      (rec.byMonthDay < 1 || rec.byMonthDay > 31)
    ) {
      s.t = before;
      continue;
    }
    return rec;
  }
  return undefined;
}
