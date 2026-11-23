/**
 * „Plan einfügen“ (docs/design/usecases/tag-kippt/TARGET.md §3): reads a finished plan from outside – the ToDos' JSON
 * (`plannedFor`, `someday`, `estimateMin`) or text from a chat with day headings and bullets – into things with a
 * place. Pure and local: no model, no network, no clock (today comes in). German day words, a few English ones.
 */
import { addDaysStr, DATE_RE, isCalendarDate, isoWeekday } from '@/core/time/dates';

/** Where a thing is or goes in the plan: a day, „Noch ohne Tag“ (this week) or „Nächste Wochen“. */
export type Place = { kind: 'day'; date: string } | { kind: 'week' } | { kind: 'later' };

/** Where a pasted thing goes: a place, or – no heading above it – nowhere named. */
export type PasteWhen = Place | { kind: 'none' };

export interface PastedThing {
  title: string;
  when: PasteWhen;
  /** Effort in minutes („15 Minuten“, „20–30 Min“ → 30: the upper bound). */
  minutes?: number;
}

export interface PastedPlan {
  format: 'json' | 'text';
  things: PastedThing[];
  /** Lines that are no things (chat prose, other collections, subtasks): the preview says so, without a figure. */
  skipped: number;
  /** „Ziel fürs Wochenende: Wohnung frei bekommen“ (P2): the goal of the days the paste names, text only. */
  goal?: string;
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
/** A pasted line is untrusted: longer ones are cut before any pattern reads them. */
const MAX_LINE = 2 * MAX_TITLE;

/** True when the text looks like a plan to paste (several lines, or JSON with things) and not like one entry. */
export function looksLikePlan(text: string): boolean {
  const trimmed = text.trim();
  if (/^[[{]/.test(trimmed)) {
    try {
      return readJson(JSON.parse(trimmed) as unknown).things.length > 0;
    } catch {
      return false;
    }
  }
  return trimmed.split(/\r?\n/).filter((l) => l.trim()).length >= 2;
}

/** Reads the pasted text. `today` is 'YYYY-MM-DD' (weekday names resolve from yesterday on). */
export function readPastedPlan(text: string, today: string): PastedPlan {
  const trimmed = text.trim();
  if (/^[[{]/.test(trimmed)) {
    try {
      return readJson(JSON.parse(trimmed) as unknown);
    } catch {
      // Not JSON after all: read it as text.
    }
  }
  return readText(trimmed, today);
}

/** A real calendar day ('2026-11-31' is none). */
const isDay = (date: string): boolean => DATE_RE.test(date) && isCalendarDate(date);

function readJson(data: unknown): PastedPlan {
  const items: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : [];
  const things: PastedThing[] = [];
  let skipped = 0;
  for (const raw of items.slice(0, MAX_THINGS * 10)) {
    if (!raw || typeof raw !== 'object') {
      skipped++;
      continue;
    }
    const item = raw as Record<string, unknown>;
    const collection = item.collection;
    const title = typeof item.title === 'string' ? clean(item.title.slice(0, MAX_LINE)) : '';
    // Subtasks stay with their task (the plan knows top-level things only); done ones are done.
    if (
      (collection !== undefined && collection !== 'task') ||
      !title ||
      item.done === true ||
      item.parentId !== undefined
    ) {
      skipped++;
      continue;
    }
    const date = typeof item.plannedFor === 'string' ? item.plannedFor : undefined;
    const when: PasteWhen =
      item.someday === true
        ? { kind: 'later' }
        : date && isDay(date)
          ? { kind: 'day', date }
          : { kind: 'none' };
    const est = item.estimateMin;
    const minutes =
      typeof est === 'number' && Number.isInteger(est) && est >= 1 && est <= 480 ? est : undefined;
    things.push({ title, when, ...(minutes ? { minutes } : {}) });
  }
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

/** 0 = Sunday … 6 = Saturday, as the table above. */
const weekdayOf = (date: string) => isoWeekday(date) % 7;

/**
 * A heading's day: „Heute“, „Morgen“, „Samstag“, „So 29.11.“, „29.11.2026“, „2026-11-29“. A weekday name is today or
 * the next such day – except yesterday's name as the paste's first day (Saturday's plan pasted again on Sunday): that
 * is yesterday, so the preview asks once. After an earlier day of the same paste (`after`) a weekday name goes on from
 * there („Montag … Sonntag“ pasted on a Wednesday is one week ahead, not two days of the past).
 */
function dayOfHeading(words: string, today: string, after?: string): string | undefined {
  const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(words);
  if (iso) return isDay(iso[1]!) ? iso[1] : undefined;
  const dm = /\b(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})?/.exec(words);
  if (dm) {
    const d = Number(dm[1]);
    const m = Number(dm[2]);
    const year = dm[3]
      ? Number(dm[3].length === 2 ? `20${dm[3]}` : dm[3])
      : nearestYear(today, m, d);
    const date = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return isDay(date) ? date : undefined;
  }
  const lower = words.toLowerCase();
  if (/\b(heute|today)\b/.test(lower)) return today;
  if (/\bübermorgen\b/.test(lower)) return addDaysStr(today, 2);
  if (/\b(morgen|tomorrow)\b/.test(lower)) return addDaysStr(today, 1);
  const first = /^[a-zäöü]+/.exec(lower.replace(/^(am|on)\s+/, ''))?.[0];
  if (first && first in WEEKDAYS) {
    const want = WEEKDAYS[first]!;
    if (after && after >= today) return addDaysStr(after, (want - weekdayOf(after) + 7) % 7);
    const ahead = (want - weekdayOf(today) + 7) % 7;
    return addDaysStr(today, ahead === 6 ? -1 : ahead);
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

const LATER_WORDS =
  '(?:später|spaeter|nächste[nr]?\\s+woche[n]?|naechste[nr]?\\s+woche[n]?|kommende[nr]?\\s+woche[n]?|coming weeks?|verschoben|irgendwann|nicht gestrichen|later|next weeks?|someday)';
const WEEK_WORDS = '(?:diese woche|im laufe der woche|unter der woche|this week|during the week)';
const LATER_RE = new RegExp(`\\b${LATER_WORDS}\\b`, 'i');
const WEEK_RE = new RegExp(`\\b${WEEK_WORDS}\\b`, 'i');
/** An unmarked line is a heading only when it is nothing but the words („Später“, „Nächste Wochen – nicht gestrichen“). */
const LATER_ONLY = new RegExp(`^(?:${LATER_WORDS}[\\s–—-]*)+$`, 'i');
const WEEK_ONLY = new RegExp(`^${WEEK_WORDS}$`, 'i');
/** An unmarked day heading: a weekday, heute/morgen and/or a date – nothing else („Morgen Brötchen holen“ is a thing). */
const DAY_ONLY =
  /^(?:(?:am|on)\s+)?(?:heute|morgen|übermorgen|today|tomorrow|[a-zäöü]{2,10}\.?)?,?\s*(?:\d{1,2}\.\d{1,2}\.(?:\d{2,4})?|\d{4}-\d{2}-\d{2})?$/i;
const BULLET_RE = /^(?:[-*•–·+]|\d{1,2}[.)]|\[[ xX]?\])\s+/;
const DONE_RE = /^\[[xX]\]\s+/;
const GOAL_RE = /^(ziel|goal)\b[^:]*:/i;
/** A goal is a head line, not a paragraph. */
export const GOAL_MAX = 80;

/**
 * A heading line: what it says about the place of the things under it, 'other' for any other marked heading, undefined
 * for a thing. Marked = `#`, a trailing colon or bold; a list item is a heading only when marked („- **Samstag:**“).
 */
function headingWhen(
  line: string,
  today: string,
  bullet: boolean,
  after: string | undefined,
): PasteWhen | 'other' | undefined {
  const raw = line.replace(BULLET_RE, '').trim();
  const bare = raw
    .replace(/^#+\s*/, '')
    .replace(/[*_]/g, '')
    .trim();
  const withColon = /:\s*$/.test(bare);
  const words = bare.replace(/:\s*$/, '').trim();
  const marked = /^#/.test(raw) || withColon || /^\*\*.*\*\*:?$/.test(raw);
  if (words.length > 60 || (bullet && !marked)) return undefined;
  const date = dayOfHeading(words, today, after);
  if (date && (marked || DAY_ONLY.test(words))) return { kind: 'day', date };
  if (LATER_RE.test(words) && (marked || LATER_ONLY.test(words))) return { kind: 'later' };
  if (WEEK_RE.test(words) && (marked || WEEK_ONLY.test(words))) return { kind: 'week' };
  return marked && !bullet ? 'other' : undefined;
}

const DURATION_RE =
  /\(?\s*(?:ca\.?\s*|etwa\s*|~\s*)?(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:[–—-]|bis)?\s*(\d{1,4}(?:[.,]\d{1,2})?)?\s*(min(?:uten?|\.)?|minutes?|mins?|std\.?|stunden?|h|hours?)(?![a-zäöü])\s*\)?/i;

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

/** Trailing emoji and symbols („Viel Erfolg! 💪“) do not hide that a line is a sentence. */
const withoutSymbols = (line: string) => line.replace(/[\p{Extended_Pictographic}\p{S}\s]+$/u, '');

function readText(text: string, today: string): PastedPlan {
  let when: PasteWhen = { kind: 'none' };
  const things: PastedThing[] = [];
  let skipped = 0;
  // The last day heading so far: later weekday names go on from it.
  let lastDay: string | undefined;
  let goal: string | undefined;
  for (const raw of text.split(/\r?\n/, MAX_THINGS * 10)) {
    const line = raw.trim().slice(0, MAX_LINE);
    if (!line) continue;
    const goalLine = line.replace(BULLET_RE, '').replace(/^#+\s*|[*_]/g, '');
    if (GOAL_RE.test(goalLine)) {
      // The first goal line counts; its text after the colon, one line, not too long.
      const text = clean(goalLine.replace(GOAL_RE, ''));
      if (!goal && text) goal = text.slice(0, GOAL_MAX);
      continue;
    }
    const bullet = BULLET_RE.test(line);
    const heading = headingWhen(line, today, bullet, lastDay);
    if (heading === 'other') continue;
    if (heading) {
      when = heading;
      if (heading.kind === 'day') lastDay = heading.date;
      continue;
    }
    // A task list („- [ ] …“): the box goes, a ticked one („[x]“) is done and stays out.
    const body = line.replace(BULLET_RE, '');
    if (DONE_RE.test(line) || DONE_RE.test(body)) continue;
    // A line in brackets is a remark („(18:00–19:30 Training)“ of a copied plan, also when a chat bullets it).
    if (/^\(.*\)$/.test(line.replace(BULLET_RE, ''))) continue;
    // Prose of the chat („Hier ist dein neuer Plan.“): a sentence that ends in a stop and is not a bullet.
    if (!bullet && (/[.!?]$/.test(withoutSymbols(line)) || line.length > MAX_TITLE)) {
      skipped++;
      continue;
    }
    const item = body.replace(/^\[ ?\]\s*/, '');
    // A title in quotes is taken as it is (a copied title the reader would otherwise change); the effort follows it.
    // „…“ is what the copy writes; a chat may turn it into “…”, "…" or «…».
    const quoted =
      /^(?:„([^“”]{1,160})[“”]|“([^”]{1,160})”|"([^"]{1,160})"|«([^»]{1,160})»)\s*(.*)$/.exec(item);
    const literal = quoted ? (quoted[1] ?? quoted[2] ?? quoted[3] ?? quoted[4])! : undefined;
    const { rest, minutes } = readDuration(quoted ? quoted[5]! : item);
    const title = literal !== undefined ? literal.replace(/\s+/g, ' ').trim() : clean(rest);
    if (!title) continue;
    things.push({ title, when, ...(minutes ? { minutes } : {}) });
  }
  return { format: 'text', things: dedupe(things), skipped, ...(goal ? { goal } : {}) };
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

/** A thing the plan already knows: its key (`module:id`), title and place; `canLater`: its source keeps things for later. */
export interface Known {
  key: string;
  title: string;
  place: Place;
  canLater: boolean;
  /** „fest“ on its day: the preview says so and leaves a move off the day unticked. */
  locked?: boolean;
  /** Its source dates it (a training, a routine's turn): it cannot leave its day, only move to another one. */
  dated?: boolean;
  /** A timed block of its source (an appointment at 14:00): known so it is never made twice, never moved here. */
  fixed?: boolean;
}

/** One line of the preview: a pasted thing, the thing it is (if any) and where it goes. */
export interface PasteLine {
  /** Unique in the preview and stable while the text is edited: the known key, or `new:<title>`. */
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

const samePlace = (a: Place, b: Place): boolean =>
  a.kind === b.kind && (a.kind !== 'day' || (b.kind === 'day' && a.date === b.date));

/**
 * The days a pasted goal line belongs to (P2): the days the paste names under its headings – a passed day only when
 * the preview's question says „Auf heute“ (then today), else it is left out. Not the days a known thing keeps by
 * itself. Today when the paste names no day.
 */
export function goalDays(plan: PastedPlan, today: string, past: 'today' | 'none'): string[] {
  const days = new Set<string>();
  for (const x of plan.things)
    if (x.when.kind === 'day') {
      if (x.when.date >= today) days.add(x.when.date);
      else if (past === 'today') days.add(today);
    }
  return days.size ? [...days].sort() : [today];
}

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
  const lines: PasteLine[] = plan.things.map((thing) => {
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
    // A thing its source dates stays on a day: „ohne Tag“ or later would come back by itself.
    if (k?.dated && to.kind !== 'day') to = k.place;
    if (k?.fixed) to = k.place;
    const change: PasteLine['change'] = !k ? 'new' : samePlace(k.place, to) ? 'same' : 'move';
    return {
      id: k ? k.key : `new:${sameTitle(thing.title)}`,
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
          !k.fixed &&
          k.place.kind === 'day' &&
          k.place.date >= today &&
          k.place.date <= last,
      )
    : [];
  return { lines, missing, hasPast };
}

/**
 * A title as the reader will read it back: plain when it comes back unchanged, else in „…“ (a title holding an effort
 * „30 Min joggen“, a clock time, a heading word or „Ziel:“ would otherwise be changed – and become a second thing).
 */
function readsBack(title: string): string {
  const plain = title.replace(/\s+/g, ' ').trim();
  const back = readText(`- ${plain}`, '2000-01-01').things;
  const same =
    back.length === 1 && back[0]!.title === plain && !back[0]!.minutes && !/[„“]/.test(plain);
  return same ? plain : `„${plain.replace(/[„“]/g, '"')}“`;
}

/** One thing in the copied plan: its title and, when known, its minutes. Nothing else ever leaves (P3). */
export interface CopyThing {
  title: string;
  minutes?: number;
}

/** The words of the copied text (localised headings; the reader understands German and English ones). */
export interface CopyWords {
  goal: (goal: string) => string;
  day: (date: string) => string;
  /** A timed block of the day as a remark the reader skips: „(18:00–19:30 Training)“. */
  fixed: (title: string, from: string, to: string) => string;
  week: string;
  later: string;
  minutes: (min: number) => string;
}

/**
 * „Plan als Text kopieren“ (use case „Tag kippt“, P3): the plan from today on in exactly the format „Plan einfügen“
 * reads – an optional goal line, one heading per day with its fixed times as remarks and its things, then „Diese
 * Woche, ohne Tag“ and „Nächste Wochen“. Titles, minutes, days, fixed times and the goal only: no ids, other notes,
 * links, blocker labels or calendar appointments. Pure; the page puts it on the clipboard only when he taps.
 */
export function planAsText(
  plan: {
    goal?: string;
    days: readonly {
      date: string;
      things: readonly CopyThing[];
      fixed?: readonly { title: string; from: string; to: string }[];
    }[];
    week: readonly CopyThing[];
    later: readonly CopyThing[];
  },
  words: CopyWords,
): string {
  const line = (x: CopyThing) =>
    `- ${readsBack(x.title)}${x.minutes ? ` (${words.minutes(x.minutes)})` : ''}`;
  const blocks: string[] = [];
  // The goal only when it reads back as it is (a goal the reader would change would be rewritten on every day).
  if (plan.goal && readText(words.goal(plan.goal), '2000-01-01').goal === plan.goal)
    blocks.push(words.goal(plan.goal));
  for (const d of plan.days)
    if (d.things.length || d.fixed?.length)
      blocks.push(
        [
          `${words.day(d.date)}:`,
          ...(d.fixed ?? []).map((f) =>
            words.fixed(f.title.replace(/\s+/g, ' ').trim(), f.from, f.to),
          ),
          ...d.things.map(line),
        ].join('\n'),
      );
  if (plan.week.length) blocks.push([`${words.week}:`, ...plan.week.map(line)].join('\n'));
  if (plan.later.length) blocks.push([`${words.later}:`, ...plan.later.map(line)].join('\n'));
  return blocks.join('\n\n');
}
