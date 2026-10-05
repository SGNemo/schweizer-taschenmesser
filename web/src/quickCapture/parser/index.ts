import { extractAmount } from './amount';
import { extractDateTime } from './dates';
import { extractEstimate } from './estimate';
import { extractRecurrence } from './recurrence';
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
  $: 'finance',
};
const PREFIX_RE = /^\s*(t|k|e|m|l|\$)(?:\s+|(?<=\$))/i;

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"']+/i;
const KEYWORDS = {
  reminder: word(String.raw`erinnere?\s+mich(?:\s+(?:bitte\s+)?(?:daran|an|zu|dass))?`),
  todo: word(String.raw`to-?do|aufgabe|task`),
  bookmark: word(String.raw`merke(?:\s+dir)?`),
  list: word(String.raw`(?:auf\s+die\s+)?einkaufs?liste`),
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

/** First occurrence of a recurrence rule on or after `today`, used when no date was given. */
export function startForRecurrence(rec: CaptureRecurrence, today: Ymd): Ymd {
  if (rec.byWeekday?.[0]) return nextWeekday(today, rec.byWeekday[0], true);
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
  };

  const recurrence = extractRecurrence(scan);
  if (recurrence) fields.recurrence = recurrence;

  const amount = extractAmount(scan, false);
  const dt = extractDateTime(scan, opts.now);
  const bare = !amount && forced === 'finance' ? extractAmount(scan, true) : undefined;
  const money = amount ?? bare;
  if (money) {
    fields.amountMinor = money.amountMinor;
    fields.kind = money.kind;
  }
  dt.notes.forEach((n) => notes.add(n));
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
    score(scores, 'reminder', 75);
    if (hasTime) score(scores, 'event', 40);
  }
  if (money) score(scores, 'finance', 80);
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

  // Date/time defaults per type – always reported through `notes`, never silent.
  let date = dt.date;
  if (primaryType === 'event' || primaryType === 'reminder') {
    if (!date && recurrence) date = startForRecurrence(recurrence, today);
    if (!date && hasTime) {
      const nowTime = fmtTime(opts.now.getHours(), opts.now.getMinutes());
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

  if (date) fields.date = fmtDate(date);
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
