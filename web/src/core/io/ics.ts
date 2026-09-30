/**
 * iCalendar (RFC 5545) reader for calendar imports: the events of an `.ics` file or subscription feed.
 * Supported: all-day and timed events, UTC and `TZID` times (converted to the device's wall clock),
 * DURATION, folded lines, escaped text and the common RRULE forms. Anything the calendar cannot
 * represent is reported as an issue and the event is still imported as far as possible.
 */
import { addDaysStr, pad2, toDateString } from '@/core/time/dates';
import { recurrenceSchema, type Recurrence } from '@/core/recurrence/types';

export interface IcsEvent {
  uid?: string;
  title: string;
  allDay: boolean;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  location?: string;
  note?: string;
  recurrence?: Recurrence;
}

export type IcsIssueCode =
  | 'exdate' // excluded occurrences cannot be kept
  | 'rrule-unsupported' // imported as a single event
  | 'override' // a modified single occurrence of a series is skipped
  | 'cancelled'
  | 'invalid';

export interface IcsIssue {
  code: IcsIssueCode;
  title: string;
}

export interface IcsResult {
  events: IcsEvent[];
  issues: IcsIssue[];
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** Joins folded lines (a continuation starts with a space or tab) and splits into logical lines. */
export function unfold(text: string): string[] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return src.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
}

function parseProp(line: string): Prop | undefined {
  // The first colon outside a quoted parameter value separates name/params from the value.
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') quoted = !quoted;
    else if (c === ':' && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon < 1) return undefined;
  const [name, ...rawParams] = line.slice(0, colon).split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name!.toUpperCase(), params, value: line.slice(colon + 1) };
}

export const unescapeText = (v: string): string =>
  v.replace(/\\([nN,;\\])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));

/** Offset (ms) of `zone` at the given instant, via Intl (works for any IANA zone the runtime knows). */
function zoneOffsetMs(zone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Instant for a wall-clock time in `zone` (two passes handle offsets that change around the time). */
function instantIn(
  zone: string,
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let instant = guess - zoneOffsetMs(zone, new Date(guess));
  instant = guess - zoneOffsetMs(zone, new Date(instant));
  return new Date(instant);
}

interface When {
  date: string;
  time?: string;
}

const DATE_ONLY = /^(\d{4})(\d{2})(\d{2})$/;
const DATE_TIME = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/;

/** Parses DATE / DATE-TIME values into the device's local wall clock. */
export function parseWhen(value: string, params: Record<string, string>): When | undefined {
  const v = value.trim();
  const dateOnly = DATE_ONLY.exec(v);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return validDate(`${y}-${m}-${d}`) ? { date: `${y}-${m}-${d}` } : undefined;
  }
  const dt = DATE_TIME.exec(v);
  if (!dt) return undefined;
  const [, y, mo, d, h, mi, s = '00', z] = dt;
  const parts = [y, mo, d, h, mi, s].map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  if (!validDate(`${y}-${mo}-${d}`)) return undefined;
  let instant: Date | undefined;
  if (z === 'Z')
    instant = new Date(
      Date.UTC(
        ...([parts[0], parts[1] - 1, ...parts.slice(2)] as [
          number,
          number,
          number,
          number,
          number,
          number,
        ]),
      ),
    );
  else if (params.TZID) {
    try {
      instant = instantIn(params.TZID, ...parts);
    } catch {
      instant = undefined; // unknown zone: fall through to "floating"
    }
  }
  if (instant) {
    return {
      date: toDateString(instant),
      time: `${pad2(instant.getHours())}:${pad2(instant.getMinutes())}`,
    };
  }
  // Floating time: already wall clock.
  return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
}

function validDate(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const WEEKDAYS: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7 };
const FREQ: Record<string, Recurrence['freq']> = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
};

/** Maps the RRULE forms our recurrence model knows; `undefined` = cannot be represented. */
export function parseRrule(value: string): Recurrence | undefined {
  const rule: Record<string, string> = {};
  for (const part of value.split(';')) {
    const [k, v] = part.split('=');
    if (k && v !== undefined) rule[k.toUpperCase()] = v;
  }
  const freq = FREQ[rule.FREQ ?? ''];
  if (!freq) return undefined;
  const unsupported = [
    'BYSETPOS',
    'BYWEEKNO',
    'BYYEARDAY',
    'BYHOUR',
    'BYMINUTE',
    'BYSECOND',
    'RSCALE',
  ];
  if (unsupported.some((k) => k in rule)) return undefined;

  const out: Record<string, unknown> = {
    freq,
    interval: rule.INTERVAL ? Number(rule.INTERVAL) : 1,
  };
  if (rule.BYDAY) {
    const days = rule.BYDAY.split(',').map((d) => WEEKDAYS[d.trim().toUpperCase()]);
    if (days.some((d) => d === undefined)) return undefined; // "1MO", "-1FR" …
    if (freq !== 'weekly') return undefined;
    out.byWeekday = [...new Set(days as number[])].sort();
  }
  if (rule.BYMONTHDAY) {
    const days = rule.BYMONTHDAY.split(',');
    if (days.length !== 1 || freq !== 'monthly') return undefined;
    out.byMonthDay = Number(days[0]);
  }
  if (rule.BYMONTH) {
    if (rule.BYMONTH.includes(',') || freq !== 'yearly') return undefined;
    out.monthOfYear = Number(rule.BYMONTH);
  }
  if (rule.COUNT) out.count = Number(rule.COUNT);
  if (rule.UNTIL) {
    const until = parseWhen(rule.UNTIL, {});
    if (!until) return undefined;
    out.until = until.date;
  }
  const parsed = recurrenceSchema.safeParse(out);
  return parsed.success ? parsed.data : undefined;
}

/** ISO 8601 duration ("PT1H30M", "P1D", "P1W") in minutes. */
export function durationMinutes(value: string): number | undefined {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    value.trim(),
  );
  if (!m) return undefined;
  const n = (i: number) => Number(m[i] ?? 0);
  const total = n(2) * 7 * 1440 + n(3) * 1440 + n(4) * 60 + n(5) + Math.floor(n(6) / 60);
  return m[1] === '-' ? -total : total;
}

function addMinutes(when: When, minutes: number): When {
  const [y, mo, d] = when.date.split('-').map(Number) as [number, number, number];
  const [h, mi] = (when.time ?? '00:00').split(':').map(Number) as [number, number];
  const date = new Date(y, mo - 1, d, h, mi + minutes);
  return {
    date: toDateString(date),
    time: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
  };
}

export function parseIcs(text: string): IcsResult {
  const events: IcsEvent[] = [];
  const issues: IcsIssue[] = [];
  let current: Prop[] | undefined;
  let depth = 0; // nested components inside a VEVENT (VALARM …)

  for (const line of unfold(text)) {
    if (!line) continue;
    const upper = line.toUpperCase();
    if (upper === 'BEGIN:VEVENT') {
      current = [];
      depth = 0;
    } else if (current && upper === 'END:VEVENT') {
      convert(current, events, issues);
      current = undefined;
    } else if (current && upper.startsWith('BEGIN:')) depth++;
    else if (current && upper.startsWith('END:')) depth--;
    else if (current && depth === 0) {
      const prop = parseProp(line);
      if (prop) current.push(prop);
    }
  }
  return { events, issues };
}

function convert(props: Prop[], events: IcsEvent[], issues: IcsIssue[]): void {
  const first = (name: string) => props.find((p) => p.name === name);
  const summary = unescapeText(first('SUMMARY')?.value ?? '').trim();
  const title = summary || '(ohne Titel)';

  if (first('STATUS')?.value.toUpperCase() === 'CANCELLED') {
    issues.push({ code: 'cancelled', title });
    return;
  }
  if (first('RECURRENCE-ID')) {
    issues.push({ code: 'override', title });
    return;
  }
  const dtstart = first('DTSTART');
  const start = dtstart && parseWhen(dtstart.value, dtstart.params);
  if (!start) {
    issues.push({ code: 'invalid', title });
    return;
  }
  const allDay = start.time === undefined;
  const event: IcsEvent = { title, allDay, startDate: start.date };
  if (!allDay) event.startTime = start.time;

  // End: DTEND, else DURATION, else nothing (a point event / a single all-day date).
  const dtend = first('DTEND');
  const duration = first('DURATION');
  let end: When | undefined;
  if (dtend) end = parseWhen(dtend.value, dtend.params);
  else if (duration) {
    const minutes = durationMinutes(duration.value);
    if (minutes !== undefined && minutes > 0)
      end = allDay
        ? { date: addDaysStr(start.date, Math.floor(minutes / 1440)) }
        : addMinutes(start, minutes);
  }
  if (end) {
    if (allDay) {
      // DTEND of an all-day event is exclusive.
      const last = addDaysStr(end.date, -1);
      if (last > start.date) event.endDate = last;
    } else if (end.time) {
      if (end.date > start.date) {
        event.endDate = end.date;
        event.endTime = end.time;
      } else if (end.date === start.date && end.time > start.time!) {
        event.endTime = end.time;
      }
    }
  }

  const location = unescapeText(first('LOCATION')?.value ?? '').trim();
  if (location) event.location = location;
  const note = unescapeText(first('DESCRIPTION')?.value ?? '').trim();
  if (note) event.note = note;
  const uid = first('UID')?.value.trim();
  if (uid) event.uid = uid;

  const rrule = first('RRULE');
  if (rrule) {
    const recurrence = parseRrule(rrule.value);
    if (recurrence) event.recurrence = recurrence;
    else issues.push({ code: 'rrule-unsupported', title });
  }
  if (props.some((p) => p.name === 'EXDATE')) issues.push({ code: 'exdate', title });

  events.push(event);
}
