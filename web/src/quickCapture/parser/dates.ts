import type { CaptureNote } from './types';
import { WEEKDAYS, WEEKDAY_SRC } from './recurrence';
import {
  addDays,
  addMonths,
  cmpDate,
  fmtTime,
  fromDate,
  isValidDate,
  lastDayOfMonth,
  nextWeekday,
  take,
  word,
  type Scan,
  type Ymd,
} from './util';

const MONTHS: Record<string, number> = {
  januar: 1,
  jänner: 1,
  februar: 2,
  märz: 3,
  maerz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
  jan: 1,
  feb: 2,
  mär: 3,
  mrz: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  okt: 10,
  nov: 11,
  dez: 12,
};
const MONTH_SRC = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join('|');

/** Default hour for a part of the day; these are approximations and flagged as such. */
const DAY_PARTS: Record<string, [number, number]> = {
  früh: [8, 0],
  morgens: [8, 0],
  vormittag: [10, 0],
  vormittags: [10, 0],
  mittag: [12, 0],
  mittags: [12, 0],
  nachmittag: [15, 0],
  nachmittags: [15, 0],
  abend: [18, 0],
  abends: [18, 0],
  nacht: [22, 0],
  nachts: [22, 0],
};
const PART_SRC = Object.keys(DAY_PARTS)
  .sort((a, b) => b.length - a.length)
  .join('|');

export interface DateTimeState {
  date?: Ymd;
  time?: string;
  /** The date came from a year-less day/month that was moved into the next year. */
  notes: Set<CaptureNote>;
}

const num = (s: string | undefined): number => Number(s);
const validHour = (h: number, min: number): boolean => h >= 0 && h <= 23 && min >= 0 && min <= 59;

function setTime(st: DateTimeState, h: number, min: number, approx = false): boolean {
  if (st.time !== undefined || !validHour(h, min)) return false;
  st.time = fmtTime(h, min);
  if (approx) st.notes.add('approx-time');
  return true;
}

/** Resolves a year-less day/month to the next occurrence on or after today. */
function resolveYearless(
  today: Ymd,
  month: number,
  day: number,
  notes: Set<CaptureNote>,
): Ymd | undefined {
  for (let y = today.y; y <= today.y + 4; y++) {
    if (!isValidDate(y, month, day)) continue;
    const cand = { y, m: month, d: day };
    if (cmpDate(cand, today) >= 0) {
      if (y > today.y) notes.add('rolled-year');
      return cand;
    }
  }
  return undefined;
}

function fullYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

function setExplicitDate(st: DateTimeState, today: Ymd, y: number, m: number, d: number): boolean {
  if (st.date || !isValidDate(y, m, d)) return false;
  st.date = { y, m, d };
  if (cmpDate(st.date, today) < 0) st.notes.add('past-date');
  return true;
}

/** Relative time: "in 2 Stunden", "in einer halben Stunde", "in 45 Minuten". */
function extractRelativeTime(s: Scan, st: DateTimeState, now: Date): void {
  if (st.time !== undefined) return;
  const re = word(
    String.raw`in\s+(?:(\d{1,3})|einer\s+halben|einer|einem|eine)\s+(minuten?|min|stunden?|std)`,
  );
  const before = s.t;
  const m = take(s, re);
  if (!m) return;
  const isMinutes = m[2]!.toLowerCase().startsWith('min');
  const amount = m[1] ? num(m[1]) : /halben/i.test(m[0]) ? 0.5 : 1;
  const minutes = Math.round(amount * (isMinutes ? 1 : 60));
  if (st.date || minutes <= 0) {
    s.t = before;
    return;
  }
  const at = new Date(now.getTime() + minutes * 60_000);
  st.date = fromDate(at);
  st.time = fmtTime(at.getHours(), at.getMinutes());
}

function extractClockTime(s: Scan, st: DateTimeState): void {
  if (st.time !== undefined) return;
  const rules: { re: RegExp; run: (m: RegExpExecArray) => boolean }[] = [
    {
      // "15 Uhr", "15:30 Uhr", "15.30 Uhr", "15 Uhr 30"
      re: /(?<![\d.,:])(?:um\s+|gegen\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*uhr(?:\s+(\d{2})(?!\d))?(?![\p{L}\d])/iu,
      run: (m) => setTime(st, num(m[1]), num(m[2] ?? m[3] ?? '0')),
    },
    {
      // "15:30"
      re: /(?<![\d.,:])(?:um\s+|gegen\s+)?(\d{1,2}):(\d{2})(?![\d:])/iu,
      run: (m) => setTime(st, num(m[1]), num(m[2])),
    },
    {
      // "halb 3" = 2:30 in German
      re: word(String.raw`halb\s+(\d{1,2})`),
      run: (m) => {
        const h = num(m[1]);
        if (h < 1 || h > 12) return false;
        if (!setTime(st, h === 1 ? 12 : h - 1, 30)) return false;
        if (h <= 6) st.notes.add('ambiguous-time');
        return true;
      },
    },
    {
      // "um 9"
      re: /(?<![\d.,:])(?:um|gegen)\s+(\d{1,2})(?![\d.,:])(?!\s*(?:%|€))/iu,
      run: (m) => {
        const h = num(m[1]);
        if (!setTime(st, h, 0)) return false;
        if (h >= 1 && h <= 6) st.notes.add('ambiguous-time');
        return true;
      },
    },
  ];
  for (const rule of rules) {
    const before = s.t;
    const m = take(s, rule.re);
    if (!m) continue;
    if (rule.run(m)) return;
    s.t = before;
  }
}

function extractDate(s: Scan, st: DateTimeState, today: Ymd): void {
  if (st.date) return;
  const rules: { re: RegExp; run: (m: RegExpExecArray) => boolean }[] = [
    {
      re: /(?<![\d.,-])(\d{4})-(\d{2})-(\d{2})(?![\d])/u,
      run: (m) => setExplicitDate(st, today, num(m[1]), num(m[2]), num(m[3])),
    },
    {
      // "am 3.10.", "3.10.2026", "3.10.26"
      re: /(?<![\p{L}\d.,])(?:am\s+)?(\d{1,2})\.\s?(\d{1,2})\.(?:\s?(\d{4})|(\d{2}))?(?![\d])/iu,
      run: (m) => {
        const year = m[3] ?? m[4];
        if (year) return setExplicitDate(st, today, fullYear(num(year)), num(m[2]), num(m[1]));
        const d = resolveYearless(today, num(m[2]), num(m[1]), st.notes);
        if (d) st.date = d;
        return d !== undefined;
      },
    },
    {
      // "3. Oktober", "am 3. Okt 2026"
      re: new RegExp(
        String.raw`(?<![\p{L}\d.,])(?:am\s+)?(\d{1,2})\.?\s*(${MONTH_SRC})\.?(?![\p{L}\d])(?:\s+(\d{4})(?![\d]))?`,
        'iu',
      ),
      run: (m) => {
        const month = MONTHS[m[2]!.toLowerCase()]!;
        if (m[3]) return setExplicitDate(st, today, num(m[3]), month, num(m[1]));
        const d = resolveYearless(today, month, num(m[1]), st.notes);
        if (d) st.date = d;
        return d !== undefined;
      },
    },
    {
      // "heute morgen" = this morning (must win over the plain word "morgen")
      re: word(String.raw`heute\s+morgen`),
      run: () => {
        st.date = today;
        setTime(st, 8, 0, true);
        return true;
      },
    },
    {
      // "morgen früh", "übermorgen abend", "heute Nachmittag"
      re: word(String.raw`(heute|übermorgen|morgen)\s+(${PART_SRC})`),
      run: (m) => {
        const day = m[1]!.toLowerCase();
        st.date = addDays(today, day === 'heute' ? 0 : day === 'morgen' ? 1 : 2);
        const [h, min] = DAY_PARTS[m[2]!.toLowerCase()]!;
        setTime(st, h, min, true);
        return true;
      },
    },
    {
      re: word('vorgestern'),
      run: () => ((st.date = addDays(today, -2)), true),
    },
    {
      re: word('gestern'),
      run: () => ((st.date = addDays(today, -1)), true),
    },
    {
      re: word('übermorgen'),
      run: () => ((st.date = addDays(today, 2)), true),
    },
    {
      re: word('morgen'),
      run: () => ((st.date = addDays(today, 1)), true),
    },
    {
      re: word('heute'),
      run: () => ((st.date = today), true),
    },
    {
      // "Freitag", "am Freitag", "nächsten Montag": always the upcoming one, never today
      re: word(String.raw`(?:(?:am|nächsten|nächste|kommenden)\s+)?(${WEEKDAY_SRC})`),
      run: (m) => ((st.date = nextWeekday(today, WEEKDAYS[m[1]!.toLowerCase()]!, false)), true),
    },
    {
      re: word(String.raw`in\s+(?:(\d{1,3})|einer|einem|eine)\s+(tag(?:en)?|wochen?|monat(?:en)?)`),
      run: (m) => {
        const n = m[1] ? num(m[1]) : 1;
        const unit = m[2]!.toLowerCase();
        if (n < 1) return false;
        st.date = unit.startsWith('tag')
          ? addDays(today, n)
          : unit.startsWith('woche')
            ? addDays(today, n * 7)
            : addMonths(today, n);
        return true;
      },
    },
    {
      re: word('nächste\\s+woche|kommende\\s+woche'),
      run: () => ((st.date = nextWeekday(today, 1, false)), true),
    },
    {
      re: word('nächsten\\s+monat|kommenden\\s+monat'),
      run: () => ((st.date = { ...addMonths({ ...today, d: 1 }, 1) }), true),
    },
    {
      re: word('ende\\s+(?:des\\s+)?monats|monatsende'),
      run: () => ((st.date = { ...today, d: lastDayOfMonth(today.y, today.m) }), true),
    },
  ];
  for (const rule of rules) {
    const before = s.t;
    const m = take(s, rule.re);
    if (!m) continue;
    if (rule.run(m)) return;
    s.t = before;
  }
}

/** A lone part of the day ("abends", "mittags") once no clock time was found. */
function extractDayPart(s: Scan, st: DateTimeState): void {
  if (st.time !== undefined) return;
  const m = take(s, word(String.raw`(?:${PART_SRC})`));
  if (!m) return;
  const [h, min] = DAY_PARTS[m[0].toLowerCase()]!;
  setTime(st, h, min, true);
}

/**
 * Extracts date and time from `s` (matches are blanked out). Order matters: clock times first so
 * "15.30 Uhr" is not read as a date, then dates, then loose day-part words.
 */
export function extractDateTime(s: Scan, now: Date): DateTimeState {
  const today = fromDate(now);
  const st: DateTimeState = { notes: new Set() };
  extractRelativeTime(s, st, now);
  extractClockTime(s, st);
  extractDate(s, st, today);
  extractDayPart(s, st);
  return st;
}
