import { extractAmount } from './amount';
import { extractDateTime } from './dates';
import { extractEndTime } from './endtime';
import { extractEstimate } from './estimate';
import { extractRecurrence } from './recurrence';
import { extractUntil } from './until';
import type {
  CaptureAlternative,
  CaptureFields,
  CaptureNote,
  CaptureRecurrence,
  CaptureResult,
  CaptureType,
  ParseOptions,
} from './types';
import {
  addDays,
  cmpDate,
  fmtDate,
  fmtTime,
  fromDate,
  isValidDate,
  nextWeekday,
  take,
  word,
  type Scan,
  type Ymd,
} from './util';

export type * from './types';
export { toCents } from './amount';

/** Shortcut prefixes; they fix the type and skip detection. */
const PREFIXES: Record<string, CaptureType> = {
  t: 'todo',
  k: 'event',
  e: 'reminder',
  m: 'bookmark',
  l: 'list',
  n: 'note',
  r: 'invoice',
  $: 'finance',
};
const PREFIX_RE = /^\s*(t|k|e|m|l|n|r|\$)(?:\s+|(?<=\$))/i;

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"']+/i;
const KEYWORDS = {
  reminder: word(String.raw`erinnere?\s+mich(?:\s+(?:bitte\s+)?(?:daran|an|zu|dass))?`),
  todo: word(String.raw`to-?do|aufgabe|task`),
  bookmark: word(String.raw`merke(?:\s+dir)?`),
  list: word(String.raw`(?:auf\s+die\s+)?einkaufs?liste`),
  invoice: word(String.raw`rechnung`),
  birthday: word(String.raw`geburtstage?`),
  spend: word(String.raw`ausgaben?|ausgegeben`),
  income: word(String.raw`einnahmen?`),
  due: word(String.raw`fällig(?:keit)?(?:\s+am)?|zahlbar`),
};
/** Words that make a dated sentence a deadline (a ToDo), even with a clock time. */
const DEADLINE = word(String.raw`abgeben|abgabe|einreichen|abschicken|hochladen|deadline|frist`);
/** "bis 5.11.", "fällig am": a payment target when an amount is there. */
const DUE_HINT = word(String.raw`bis|fällig|zahlbar`);
const PRIORITY_RE = /(?<![\p{L}\d])!(hoch|wichtig|dringend|mittel|niedrig)(?![\p{L}\d])/iu;
const PRIORITY: Record<string, 1 | 2 | 3> = {
  hoch: 3,
  wichtig: 3,
  dringend: 3,
  mittel: 2,
  niedrig: 1,
};
const DANGLING =
  /^(?:um|am|an|den|dem|bis|ab|für|und|zu|dass|,|;|:|-|–)+\s+|\s+(?:um|am|an|den|dem|bis|ab|für|und|zu|,|;|:|-|–)+$/iu;

function cleanTitle(raw: string): string {
  let t = raw.replace(/\s+/g, ' ').trim();
  for (let prev = ''; prev !== t;) {
    prev = t;
    t = t.replace(DANGLING, '').replace(/^[\s,;:–-]+|[\s,;:–-]+$/gu, '');
  }
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * First occurrence of a recurrence rule on or after `today`, used when no date was given. With
 * `skipToday` a weekday rule starts at the next matching day after today (today's time is past).
 */
export function startForRecurrence(rec: CaptureRecurrence, today: Ymd, skipToday = false): Ymd {
  if (rec.byWeekday?.length) {
    const days = rec.byWeekday.map((wd) => nextWeekday(today, wd, !skipToday));
    return days.reduce((a, b) => (cmpDate(b, a) < 0 ? b : a));
  }
  const day = rec.byMonthDay;
  if (day !== undefined) {
    if (day === -1) return { ...today, d: new Date(today.y, today.m, 0).getDate() };
    for (let i = 0; i < 24; i++) {
      const m0 = today.m - 1 + i;
      const y = today.y + Math.floor(m0 / 12);
      const m = (m0 % 12) + 1;
      if (!isValidDate(y, m, day)) continue;
      const cand = { y, m, d: day };
      if (cmpDate(cand, today) >= 0) return cand;
    }
  }
  return today;
}

const score = (m: Map<CaptureType, number>, type: CaptureType, value: number): void => {
  m.set(type, Math.max(m.get(type) ?? 0, value));
};

/**
 * Parses free German text into a capture suggestion. Local, deterministic, never throws and never
 * logs its input. Low confidence sets `needsChoice`; the caller must not pick silently then.
 */
export function parseCapture(input: string, opts: ParseOptions): CaptureResult {
  const defaultType = opts.defaultType ?? 'todo';
  const today = fromDate(opts.now);
  const notes = new Set<CaptureNote>();

  let text = input;
  let forced: CaptureType | undefined;
  const prefix = PREFIX_RE.exec(text);
  if (prefix) {
    forced = PREFIXES[prefix[1]!.toLowerCase()];
    text = text.slice(prefix[0].length);
  }
  const scan: Scan = { t: text };

  const fields: CaptureFields = { title: '' };
  const url = take(scan, URL_RE)?.[0]?.replace(/[.,;:!?)]+$/, '');
  if (url) fields.url = /^www\./i.test(url) ? `https://${url}` : url;

  const kw = {
    reminder: !!take(scan, KEYWORDS.reminder),
    todo: !!take(scan, KEYWORDS.todo),
    bookmark: !!take(scan, KEYWORDS.bookmark),
    list: !!take(scan, KEYWORDS.list),
    invoice: !!take(scan, KEYWORDS.invoice),
    birthday: !!take(scan, KEYWORDS.birthday),
    spend: !!take(scan, KEYWORDS.spend),
    income: !!take(scan, KEYWORDS.income),
    due: !!take(scan, KEYWORDS.due),
    deadline: DEADLINE.test(scan.t),
    dueHint: DUE_HINT.test(scan.t),
  };

  const priorityMatch = take(scan, PRIORITY_RE);
  if (priorityMatch) fields.priority = PRIORITY[priorityMatch[1]!.toLowerCase()];

  const recurrence = extractRecurrence(scan);
  if (recurrence) {
    const until = extractUntil(scan, opts.now);
    if (until) recurrence.until = until;
    fields.recurrence = recurrence;
  }
  const endTime = extractEndTime(scan);
  const slowRecurrence =
    recurrence && (recurrence.freq === 'monthly' || recurrence.freq === 'yearly');

  const amount = extractAmount(scan, false);
  const dt = extractDateTime(scan, opts.now);
  const wantsBare =
    forced === 'finance' || forced === 'invoice' || kw.invoice || kw.spend || kw.income;
  const bare = amount
    ? undefined
    : wantsBare
      ? extractAmount(scan, true)
      : slowRecurrence
        ? extractAmount(scan, 'decimal')
        : undefined;
  const money = amount ?? bare;
  if (money) {
    fields.amountMinor = money.amountMinor;
    fields.kind = kw.income ? 'income' : money.kind;
  }
  dt.notes.forEach((n) => notes.add(n));
  if (endTime && dt.time !== undefined) fields.endTime = endTime;
  // The estimate is only taken for ToDos (decided below); everything else keeps the text as typed.
  const estimateScan: Scan = { t: scan.t };
  const estimate = extractEstimate(estimateScan);

  const hasDate = !!dt.date;
  const hasTime = dt.time !== undefined;

  // Type detection. Scores are integers (0–100) so margins compare exactly.
  const scores = new Map<CaptureType, number>();
  if (fields.url) score(scores, 'bookmark', 90);
  if (kw.bookmark) score(scores, 'bookmark', fields.url ? 95 : 90);
  if (kw.list) score(scores, 'list', 95);
  if (kw.reminder) score(scores, 'reminder', 95);
  if (kw.todo) score(scores, 'todo', 95);
  if (recurrence && !kw.reminder) {
    // A fixed weekly slot ("Mo–Fr 6 Uhr", "jeden Dienstag 16 Uhr") is an appointment, a daily
    // "8 Uhr Tabletten" stays a reminder.
    const slot = hasTime && (recurrence.byWeekday?.length || recurrence.until || endTime);
    score(scores, 'reminder', slot ? 60 : 75);
    if (hasTime) score(scores, 'event', slot ? 88 : 40);
  }
  if (money) score(scores, 'finance', kw.spend || kw.income ? 92 : 80);
  if (money && slowRecurrence && !hasTime && !kw.invoice) score(scores, 'subscription', 92);
  if (money && kw.invoice) score(scores, 'invoice', 92);
  else if (money && hasDate && !recurrence && (kw.due || kw.dueHint) && !kw.spend && !kw.income)
    score(scores, 'invoice', 90);
  if (kw.birthday && hasDate && !hasTime && !recurrence) score(scores, 'birthday', 93);
  if (kw.deadline && !money && !recurrence) score(scores, 'todo', 96);
  if (hasDate && hasTime && !recurrence) score(scores, 'event', 85);
  else if (!hasDate && hasTime && !recurrence) score(scores, 'event', 70);
  else if (hasDate && !hasTime && !recurrence && !money) {
    score(scores, 'todo', 65);
    score(scores, 'event', 50);
  }
  if (scores.size === 0) score(scores, defaultType, 75);

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [primaryType, primaryScore] = forced ? [forced, 100] : ranked[0]!;
  const second = ranked.find(([t]) => t !== primaryType)?.[1] ?? 0;
  const needsChoice = !forced && (primaryScore < 60 || primaryScore - second < 10);

  const nowTime = fmtTime(opts.now.getHours(), opts.now.getMinutes());
  const timePassed = hasTime && dt.time! <= nowTime;

  // Date/time defaults per type – always reported through `notes`, never silent.
  let date = dt.date;
  if (primaryType === 'event' || primaryType === 'reminder') {
    if (!date && recurrence) date = startForRecurrence(recurrence, today, timePassed);
    if (!date && hasTime) {
      date = dt.time! > nowTime ? today : addDays(today, 1);
      notes.add('assumed-date');
    }
    if (!date && primaryType === 'reminder') {
      date = today;
      notes.add('assumed-date');
    }
  } else if (!date && recurrence) {
    date = startForRecurrence(recurrence, today);
  }
  if (primaryType === 'finance' && !date) date = today;
  if (primaryType === 'invoice' && !date) {
    date = addDays(today, 14); // a usual payment term; reported as an assumption, never silent
    notes.add('assumed-date');
  }

  if (date) fields.date = fmtDate(date);
  if (primaryType !== 'todo') delete fields.priority;
  if (dt.time !== undefined) fields.time = dt.time;
  if (primaryType === 'event' && date && !hasTime) fields.allDay = true;

  if (estimate !== undefined && primaryType === 'todo') {
    fields.estimateMin = estimate;
    scan.t = estimateScan.t;
  }

  fields.title = cleanTitle(scan.t) || (fields.url ?? '') || cleanTitle(text);

  const alternatives: CaptureAlternative[] = ranked
    .filter(([t, s]) => t !== primaryType && s >= 30)
    .map(([type, s]) => ({ type, confidence: s / 100 }));

  return {
    type: primaryType,
    fields,
    confidence: primaryScore / 100,
    needsChoice,
    forced: !!forced,
    alternatives,
    notes: [...notes],
  };
}
