import { extractAmount, toCents } from './amount';
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

/** Shortcut prefixes; they fix the type and skip detection (also shown as a hint in Settings → Schnellerfassung). */
export const PREFIXES: Record<string, CaptureType> = {
  t: 'todo',
  k: 'event',
  e: 'reminder',
  m: 'bookmark',
  l: 'list',
  n: 'note',
  r: 'invoice',
  p: 'plan',
  $: 'finance',
};
/** A one-letter prefix ("t ", "$12") or the word „plan:“ (the planner's capture). */
const PREFIX_RE = /^\s*(?:(t|k|e|m|l|n|r|p|\$)(?:\s+|(?<=\$))|(plan)\s*:\s*)/i;
/** Short German weekdays after a planning word („ab Do“, „bis Fr.“): spelled out for the date extractor (plan only). */
const SHORT_DAYS: Record<string, string> = {
  mo: 'Montag',
  di: 'Dienstag',
  mi: 'Mittwoch',
  do: 'Donnerstag',
  fr: 'Freitag',
  sa: 'Samstag',
  so: 'Sonntag',
};
const SHORT_DAY_RE = word(String.raw`(ab|bis|am|frist)\s+(mo|di|mi|do|fr|sa|so)\.?`);
/**
 * Outside plans a short weekday counts only where it cannot be a plain word (C03): after „am/ab/bis/Frist“, or
 * right before a time with „Uhr“ or a colon („Do 14 Uhr“, „Di. 14:30“), written as a day (capital or
 * dot). „So ein …“, „Fr. Müller“, „kommt so 15 Uhr“, „am so schönsten“ stay text.
 */
const SHORT_DAY_ANY_RE =
  /(?<![\p{L}\d])(?:([Aa]m|[Aa]b|[Bb]is|[Ff]rist)\s+(Mo|Di|Mi|Do|Fr|Sa|So|mo\.|di\.|mi\.|do\.|fr\.|sa\.|so\.)\.?|()(Mo|Di|Mi|Do|Fr|Sa|So)\.?(?=\s+(?:um\s+)?\d{1,2}(?::\d{2}\s*(?:[Uu]hr)?|\s*[Uu]hr)(?![\p{L}\d])))(?![\p{L}\d])/u;
/**
 * A euro amount without currency word at the very start or end („Tanken 62,40“, C02): two decimals
 * only. A clock-shaped value („14,30“) is no amount after a time word or next to a day (see below).
 */
const EDGE_CENTS_RE =
  /^\s*(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})(?=\s+\S)|(?<=\S\s+)(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})\s*$/iu;
/** „ab Do“: the day is the earliest one, not a pin. */
const FROM_WORD = word(String.raw`ab`);
/** „bis Do“, „Frist Do“: a hard deadline in a plan capture. */
const PLAN_DUE = word(String.raw`bis|frist|deadline|abgabe|spätestens`);
const PLAN_DUE_WORD = word(String.raw`frist|deadline|spätestens`);

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
    forced = prefix[2] ? 'plan' : PREFIXES[prefix[1]!.toLowerCase()];
    text = text.slice(prefix[0].length);
  }
  if (forced === 'plan') {
    for (let m = SHORT_DAY_RE.exec(text); m; m = SHORT_DAY_RE.exec(text)) {
      const long = SHORT_DAYS[m[2]!.toLowerCase()]!;
      text = `${text.slice(0, m.index)}${m[1]} ${long}${text.slice(m.index + m[0].length)}`;
    }
  }
  if (forced !== 'plan') {
    for (let m = SHORT_DAY_ANY_RE.exec(text); m; m = SHORT_DAY_ANY_RE.exec(text)) {
      const long = SHORT_DAYS[(m[2] ?? m[4])!.toLowerCase().replace('.', '')]!;
      text = `${text.slice(0, m.index)}${m[1] ? `${m[1]} ` : ''}${long}${text.slice(m.index + m[0].length)}`;
    }
  }
  const plan =
    forced === 'plan' ? { from: FROM_WORD.test(text), due: PLAN_DUE.test(text) } : undefined;
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
  // Not when the text has a time („morgen 9 Uhr Zahnarzt 45,00“ stays an event). With a day, only a
  // value that cannot be a clock time („gestern Tanken 62,40“ yes, „Training am Do 18,30“ no).
  const edgeMatch =
    amount || bare || forced || recurrence || dt.time !== undefined
      ? null
      : EDGE_CENTS_RE.exec(scan.t);
  const edgeNum = edgeMatch ? (edgeMatch[1] ?? edgeMatch[2])! : undefined;
  const timeShaped = edgeNum ? /^([01]?\d|2[0-3]),[0-5]\d$/.test(edgeNum) : false;
  // „um 14,30“: the clock-shaped value right after a time word, at the end of the text.
  const afterTimeWord =
    timeShaped && /(?:^|\s)(?:um|bis|ab|gegen|von)\s+\d{1,2},\d{2}\s*$/i.test(scan.t);
  const edgeCents =
    edgeNum && !(timeShaped && (dt.date || afterTimeWord)) ? toCents(edgeNum) : undefined;
  if (edgeCents) take(scan, EDGE_CENTS_RE);
  const money =
    amount ??
    bare ??
    (edgeCents ? { amountMinor: edgeCents, kind: 'expense' as const } : undefined);
  if (money) {
    fields.amountMinor = money.amountMinor;
    fields.kind = kw.income ? 'income' : money.kind;
    if (money.currency) fields.currency = money.currency;
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

  // Date/time defaults per type – always reported through `notes`, never silent. A typed date that
  // does not exist ("31.11.") is never replaced by an assumed one: the entry stays without a date.
  let date = dt.date;
  const assume = !notes.has('invalid-date');
  if (!assume) {
    // keep the entry without a date
  } else if (primaryType === 'event' || primaryType === 'reminder') {
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
  if (primaryType === 'finance' && !date && assume) date = today;
  if (primaryType === 'invoice' && !date && assume) {
    date = addDays(today, 14); // a usual payment term; reported as an assumption, never silent
    notes.add('assumed-date');
  }

  if (date) fields.date = fmtDate(date);
  if (primaryType !== 'todo' && primaryType !== 'plan') delete fields.priority;
  if (dt.time !== undefined) fields.time = dt.time;
  if (primaryType === 'event' && date && !hasTime) fields.allDay = true;

  if (estimate !== undefined && (primaryType === 'todo' || primaryType === 'plan')) {
    fields.estimateMin = estimate;
    scan.t = estimateScan.t;
  }
  // A plan capture reads its day three ways: „bis/Frist“ = hard deadline, „ab“ = earliest, else a pin.
  if (plan && fields.date) {
    if (plan.due) {
      fields.hardDue = true;
      // The deadline word is said by the chip, not kept in the title („Steuer Frist 3.11.“ → „Steuer“).
      scan.t = scan.t.replace(PLAN_DUE_WORD, ' ');
    } else if (plan.from) {
      fields.startDate = fields.date;
      delete fields.date;
    } else {
      fields.pin = fields.date;
      delete fields.date;
    }
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
