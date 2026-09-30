import type { CaptureRecurrence } from './types';
import { take, word, type Scan } from './util';

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
    re: word(String.raw`alle\s+(\d{1,3})\s+(tage|wochen|monate|jahre)`),
    make: (m) => ({ freq: UNIT[m[2]!.toLowerCase()]!, interval: Number(m[1]) }),
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
  { re: word(String.raw`jeden\s+monat|monatlich`), make: () => ({ freq: 'monthly', interval: 1 }) },
  { re: word(String.raw`jedes\s+jahr|jährlich`), make: () => ({ freq: 'yearly', interval: 1 }) },
];

/** Extracts one recurrence phrase ("jede Woche", "jeden 1.", "alle 2 Wochen", "montags"). */
export function extractRecurrence(s: Scan): CaptureRecurrence | undefined {
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
