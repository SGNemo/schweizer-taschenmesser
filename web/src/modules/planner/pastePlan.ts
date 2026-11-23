/**
 * „Plan einfügen“ (docs/design/usecases/tag-kippt/TARGET.md §3): reads a finished plan from outside – the ToDos' JSON
 * (`plannedFor`, `someday`, `estimateMin`) or text from a chat with day headings and bullets – into things with a
 * place. Pure and local: no model, no network, no clock (today comes in). German day words, a few English ones.
 */
import { addDaysStr, DATE_RE } from '@/core/time/dates';

/** Where a pasted thing goes: a day, this week without a day, the next weeks, or no day named at all. */
export type PasteWhen =
  { kind: 'day'; date: string } | { kind: 'week' } | { kind: 'later' } | { kind: 'none' };

export interface PastedThing {
  title: string;
  when: PasteWhen;
  /** Effort in minutes („15 Minuten“, „20–30 Min“ → 30: the upper bound). */
  minutes?: number;
}

export interface PastedPlan {
  format: 'json' | 'text';
  things: PastedThing[];
  /** Lines that looked like neither a heading nor a thing (prose of the chat), counted for the preview. */
  skipped: number;
}

/** Titles are the same thing when they read the same: case, spaces and trailing marks do not count. */
export const sameTitle = (title: string): string =>
  title
    .normalize('NFC')
    .toLowerCase()
    .replace(/[„“"'’`*_]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s.,;:!?–-]+$/, '')
    .trim();

const MAX_THINGS = 200;
const MAX_TITLE = 160;

/** True when the text looks like a plan to paste (several lines, or JSON with things) and not like one entry. */
export function looksLikePlan(text: string): boolean {
  const trimmed = text.trim();
  if (/^[[{]/.test(trimmed)) {
    try {
      return readJson(JSON.parse(trimmed) as unknown, '9999-12-31').things.length > 0;
    } catch {
      return false;
    }
  }
  return trimmed.split(/\r?\n/).filter((l) => l.trim()).length >= 2;
}

/** Reads the pasted text. `today` is 'YYYY-MM-DD' (weekday names resolve to today or the next such day). */
export function readPastedPlan(text: string, today: string): PastedPlan {
  const trimmed = text.trim();
  if (/^[[{]/.test(trimmed)) {
    try {
      return readJson(JSON.parse(trimmed) as unknown, today);
    } catch {
      // Not JSON after all: read it as text.
    }
  }
  return readText(trimmed, today);
}

function readJson(data: unknown, today: string): PastedPlan {
  const items: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : [];
  const things: PastedThing[] = [];
  let skipped = 0;
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') {
      skipped++;
      continue;
    }
    const item = raw as Record<string, unknown>;
    const collection = item.collection;
    const title = typeof item.title === 'string' ? clean(item.title) : '';
    if ((collection !== undefined && collection !== 'task') || !title || item.done === true) {
      skipped++;
      continue;
    }
    const date = typeof item.plannedFor === 'string' ? item.plannedFor : undefined;
    const when: PasteWhen =
      item.someday === true
        ? { kind: 'later' }
        : date && DATE_RE.test(date)
          ? { kind: 'day', date }
          : { kind: 'none' };
    const est = item.estimateMin;
    const minutes =
      typeof est === 'number' && Number.isInteger(est) && est >= 1 && est <= 480 ? est : undefined;
    things.push({ title, when, ...(minutes ? { minutes } : {}) });
  }
  void today;
  return { format: 'json', things: dedupe(things), skipped };
}

const WEEKDAYS: Record<string, number> = {
  sonntag: 0,
  so: 0,
  sunday: 0,
  sun: 0,
  montag: 1,
  mo: 1,
  monday: 1,
  mon: 1,
  dienstag: 2,
  di: 2,
  tuesday: 2,
  tue: 2,
  mittwoch: 3,
  mi: 3,
  wednesday: 3,
  wed: 3,
  donnerstag: 4,
  do: 4,
  thursday: 4,
  thu: 4,
  freitag: 5,
  fr: 5,
  friday: 5,
  fri: 5,
  samstag: 6,
  sa: 6,
  sonnabend: 6,
  saturday: 6,
  sat: 6,
};

const weekdayOf = (date: string) => new Date(`${date}T12:00:00`).getDay();

/** A heading's day: „Heute“, „Morgen“, „Samstag“, „So 29.11.“, „29.11.2026“, „2026-11-29“. */
function dayOfHeading(words: string, today: string): string | undefined {
  const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(words);
  if (iso && DATE_RE.test(iso[1]!)) return iso[1];
  const dm = /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/.exec(words);
  if (dm) {
    const d = Number(dm[1]);
    const m = Number(dm[2]);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      const year = dm[3]
        ? Number(dm[3].length === 2 ? `20${dm[3]}` : dm[3])
        : nearestYear(today, m, d);
      return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  const lower = words.toLowerCase();
  if (/\b(heute|today)\b/.test(lower)) return today;
  if (/\bübermorgen\b/.test(lower)) return addDaysStr(today, 2);
  if (/\b(morgen|tomorrow)\b/.test(lower)) return addDaysStr(today, 1);
  const first = /^[a-zäöü]+/.exec(lower.replace(/^(am|on)\s+/, ''))?.[0];
  if (first && first in WEEKDAYS) {
    const want = WEEKDAYS[first]!;
    const ahead = (want - weekdayOf(today) + 7) % 7;
    return addDaysStr(today, ahead);
  }
  return undefined;
}

/** A date without a year: the year that puts it nearest to today (late December read in January is last year). */
function nearestYear(today: string, m: number, d: number): number {
  const y = Number(today.slice(0, 4));
  const pad = (n: number) => String(n).padStart(2, '0');
  const dist = (year: number) =>
    Math.abs(Date.parse(`${year}-${pad(m)}-${pad(d)}`) - Date.parse(today));
  return [y - 1, y, y + 1].reduce((best, year) => (dist(year) < dist(best) ? year : best), y);
}

const LATER_RE =
  /\b(später|spaeter|nächste[nr]?\s+woche[n]?|naechste[nr]?\s+woche[n]?|kommende[nr]?\s+woche[n]?|verschoben|irgendwann|nicht gestrichen|danach|later|next weeks?|someday)\b/i;
const WEEK_RE = /\b(diese woche|im laufe der woche|unter der woche|this week|during the week)\b/i;
const BULLET_RE = /^(?:[-*•–·+]|\d{1,2}[.)]|\[[ xX]?\])\s+/;
const DONE_RE = /^\[[xX]\]\s+/;
const GOAL_RE = /^(ziel|goal)\b[^:]*:/i;

/** A heading line: what it says about the place of the things under it, or undefined for any other heading. */
function headingWhen(line: string, today: string): PasteWhen | 'other' | undefined {
  const bare = line
    .replace(/^#+\s*/, '')
    .replace(/[*_]/g, '')
    .trim();
  const withColon = /:\s*$/.test(bare);
  const words = bare.replace(/:\s*$/, '').trim();
  const marked = /^#/.test(line) || withColon || /^\*\*.*\*\*:?$/.test(line.trim());
  if (words.length > 60) return undefined;
  const date = dayOfHeading(words, today);
  // A day word opens a heading only when the line is short (a thing „Morgen früh Brötchen holen“ under a bullet is not).
  if (date && (marked || words.split(/\s+/).length <= 3)) return { kind: 'day', date };
  if (LATER_RE.test(words) && (marked || words.split(/\s+/).length <= 5)) return { kind: 'later' };
  if (WEEK_RE.test(words) && (marked || words.split(/\s+/).length <= 5)) return { kind: 'week' };
  return marked ? 'other' : undefined;
}

const DURATION_RE =
  /\(?\s*(?:ca\.?\s*|etwa\s*|~\s*)?(\d+(?:[.,]\d+)?)\s*(?:[–—-]|bis)?\s*(\d+(?:[.,]\d+)?)?\s*(min(?:uten?|\.)?|minutes?|mins?|std\.?|stunden?|h|hours?)(?![a-zäöü])\s*\)?/i;

/** The effort in a line and the line without it. */
function readDuration(line: string): { rest: string; minutes?: number } {
  const m = DURATION_RE.exec(line);
  if (!m) return { rest: line };
  const n = Number((m[2] ?? m[1])!.replace(',', '.'));
  const hours = /^(std|stunde|h|hour)/i.test(m[3]!);
  const minutes = Math.round(hours ? n * 60 : n);
  const rest = (line.slice(0, m.index) + line.slice(m.index + m[0].length))
    .replace(/\s*[–—,:-]\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return minutes >= 1 && minutes <= 480 ? { rest, minutes } : { rest: line };
}

/** A title as the person reads it: no bullet, no markdown marks, no leading clock time, one line, not too long. */
function clean(title: string): string {
  return title
    .replace(BULLET_RE, '')
    .replace(/^\d{1,2}:\d{2}(?:\s*[–-]\s*\d{1,2}:\d{2})?\s*(?:uhr)?\s*[:–-]?\s*/i, '')
    .replace(/\*\*|__/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITLE);
}

function readText(text: string, today: string): PastedPlan {
  let when: PasteWhen = { kind: 'none' };
  const things: PastedThing[] = [];
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (GOAL_RE.test(line.replace(/^#+\s*|[*_]/g, ''))) continue;
    const bullet = BULLET_RE.test(line);
    if (!bullet) {
      const heading = headingWhen(line, today);
      if (heading === 'other') continue;
      if (heading) {
        when = heading;
        continue;
      }
    }
    // A task list („- [ ] …“): the box goes, a ticked one („[x]“) is done and stays out.
    const body = line.replace(BULLET_RE, '');
    if (DONE_RE.test(body)) continue;
    // Prose of the chat („Hier ist dein neuer Plan.“): a sentence that ends in a stop and is not a bullet.
    if (!bullet && (/[.!?]$/.test(line) || line.length > MAX_TITLE)) {
      skipped++;
      continue;
    }
    const { rest, minutes } = readDuration(body.replace(/^\[ ?\]\s*/, ''));
    const title = clean(rest);
    if (!title) continue;
    things.push({ title, when, ...(minutes ? { minutes } : {}) });
  }
  return { format: 'text', things: dedupe(things), skipped };
}

/** One thing per title: the first mention wins (a chat repeats a thing in a summary). */
function dedupe(things: PastedThing[]): PastedThing[] {
  const seen = new Set<string>();
  const out: PastedThing[] = [];
  for (const thing of things) {
    const key = sameTitle(thing.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(thing);
    if (out.length >= MAX_THINGS) break;
  }
  return out;
}

/** Where a thing is or goes in the plan: a day, „Noch ohne Tag“ (this week) or „Nächste Wochen“. */
export type Place = { kind: 'day'; date: string } | { kind: 'week' } | { kind: 'later' };

/** A thing the plan already knows: its key (`module:id`), title and place; `canLater`: its source keeps things for later. */
export interface Known {
  key: string;
  title: string;
  place: Place;
  canLater: boolean;
}

/** One line of the preview: a pasted thing, the thing it is (if any) and where it goes. */
export interface PasteLine {
  /** Unique in the preview: the known key, or `new:<n>`. */
  id: string;
  title: string;
  to: Place;
  minutes?: number;
  known?: Known;
  /** `same`: it already is there (nothing is written for it). */
  change: 'new' | 'move' | 'same';
  /** The pasted day lay in the past (the preview's one question decided `to`). */
  past?: boolean;
}

export interface PastePreview {
  lines: PasteLine[];
  /** Things laid between today and the paste's last day that the paste does not name: they stay as they are. */
  missing: Known[];
  /** A pasted day lies before today: the preview asks once („heute · ohne Tag“). */
  hasPast: boolean;
}

export const samePlace = (a: Place, b: Place): boolean =>
  a.kind === b.kind && (a.kind !== 'day' || (b.kind === 'day' && a.date === b.date));

/**
 * The pasted plan against what the plan holds: the same title (`sameTitle`) is the same thing – it moves, nothing is
 * doubled. A thing pasted without a heading keeps its place; a new one has no day. A passed day becomes today or no
 * day (`past`). A source that keeps nothing for later gets „ohne Tag“ instead of „Nächste Wochen“. Pure.
 */
export function matchPaste(
  plan: PastedPlan,
  known: readonly Known[],
  today: string,
  past: 'today' | 'none',
): PastePreview {
  const byTitle = new Map<string, Known>();
  for (const k of known) {
    const key = sameTitle(k.title);
    // Two open things of the same title: the one on a day wins over one without (the one he sees in the plan).
    const had = byTitle.get(key);
    if (!had || (had.place.kind !== 'day' && k.place.kind === 'day')) byTitle.set(key, k);
  }
  const used = new Set<string>();
  let hasPast = false;
  const lines: PasteLine[] = plan.things.map((thing, n) => {
    const hit = byTitle.get(sameTitle(thing.title));
    const k = hit && !used.has(hit.key) ? hit : undefined;
    if (k) used.add(k.key);
    let to: Place;
    let wasPast = false;
    const w = thing.when;
    if (w.kind === 'day') {
      if (w.date < today) {
        hasPast = true;
        wasPast = true;
        to = past === 'today' ? { kind: 'day', date: today } : { kind: 'week' };
      } else to = { kind: 'day', date: w.date };
    } else if (w.kind === 'none') to = k ? k.place : { kind: 'week' };
    else to = w.kind === 'later' ? { kind: 'later' } : { kind: 'week' };
    if (to.kind === 'later' && k && !k.canLater) to = { kind: 'week' };
    const change: PasteLine['change'] = !k ? 'new' : samePlace(k.place, to) ? 'same' : 'move';
    return {
      id: k ? k.key : `new:${n}`,
      title: k ? k.title : thing.title,
      to,
      ...(thing.minutes ? { minutes: thing.minutes } : {}),
      ...(k ? { known: k } : {}),
      change,
      ...(wasPast ? { past: true } : {}),
    };
  });
  const days = lines.flatMap((l) => (l.to.kind === 'day' ? [l.to.date] : []));
  const last = days.length ? days.reduce((a, b) => (a > b ? a : b)) : undefined;
  const missing = last
    ? known.filter(
        (k) =>
          !used.has(k.key) &&
          k.place.kind === 'day' &&
          k.place.date >= today &&
          k.place.date <= last,
      )
    : [];
  return { lines, missing, hasPast };
}
