/**
 * Stage 0 of the planner's field (docs/design/plan/CONCEPT.md §6c): German sentences like
 * „Donnerstag frei“ or „schieb Steuer auf Fr“ → ops for the engine. No model, no network, no clock:
 * `today` is an input. Dates come from the quick-capture date extractor, time windows from its
 * end-time extractor, things are matched like the write path matches its targets (`pickTarget`,
 * `withinOneEdit`). The parser never guesses: two equally good things → a question, a known verb with
 * a day it cannot read → one explaining line, anything else is no instruction (the field makes a ToDo).
 */
import { fold } from '@/core/ai/text';
import { pickTarget, withinOneEdit } from '@/core/ai/write/targets';
import { extractDateTime } from '@/quickCapture/parser/dates';
import { extractEndTime } from '@/quickCapture/parser/endtime';
import { NUMBER_WORDS } from '@/quickCapture/parser/util';
import { addDays } from './dates';

export type PlanOp =
  /** Minutes for planned work on a day (0 = a day off). */
  | { op: 'available'; date: string; min: number }
  /** A stretch of a day that is taken („14 bis 16 Uhr Werkstatt“). */
  | { op: 'block'; date: string; from: string; to: string; min: number; label: string }
  /** Nail a thing to a day. */
  | { op: 'pin'; key: string; date: string }
  /** Not before this day (the thing's own date, like „Später“). */
  | { op: 'earliest'; key: string; date: string }
  | { op: 'priority'; key: string; value: 3 }
  | { op: 'exclude'; key: string }
  | { op: 'duration'; key: string; min: number }
  /** Run again: calm (`reshuffle: false`, the previous plan stays where it can) or from scratch (`prev = []`). */
  | { op: 'replan'; reshuffle: boolean }
  /** Share of the free time never planned, in percent (a setting). */
  | { op: 'buffer'; pct: number };

/** A thing of the plan the sentence may name. */
export interface InstructionItem {
  key: string;
  title: string;
  /** The first day it is planned on, if any. */
  date?: string;
  /** Its hard due, if any. */
  hardDue?: string;
}

export interface InstructionContext {
  /** 'YYYY-MM-DD' */
  today: string;
  items: readonly InstructionItem[];
}

export type Instruction =
  | { kind: 'ops'; ops: PlanOp[] }
  /** Two things fit equally well: „Meinst du A oder B?“ – `ops(key)` once the user picked one. */
  | { kind: 'ask'; options: { key: string; title: string }[]; ops: (key: string) => PlanOp[] }
  /** A known verb, but the rest could not be read: one calm line with what works. */
  | { kind: 'explain' }
  /** A planning verb named a thing the plan does not have. */
  | { kind: 'missing'; query: string }
  /** No instruction: the field makes a ToDo. */
  | { kind: 'none' };

export const BUFFER_STEPS = [0, 10, 20, 30] as const;

const SHORT: Record<string, string> = {
  mo: 'montag',
  di: 'dienstag',
  mi: 'mittwoch',
  do: 'donnerstag',
  fr: 'freitag',
  sa: 'samstag',
  so: 'sonntag',
};
const WEEKDAY = String.raw`montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonnabend|sonntag|mo|di|mi|do|fr|sa|so`;
/** Umlauts typed three ways read the same: „nächsten“, „naechsten“, „nachsten“. */
const NEXT = String.raw`n(?:ä|ae|a)chste[nr]?`;
const DAY_AFTER = String.raw`(?:ü|ue|u)bermorgen`;
/** A day as the sentence names it. */
const DAY = String.raw`(?:(?:am\s+)?(?:(?:${NEXT}|kommende[nr]?)\s+)?(?:${WEEKDAY})\.?|heute|${DAY_AFTER}|morgen|\d{1,2}\.\d{1,2}\.(?:\d{2,4})?)`;
const NUM = String.raw`\d{1,2}(?:[.,]\d)?|anderthalb|eineinhalb|halbe|${Object.keys(NUMBER_WORDS)
  .sort((a, b) => b.length - a.length)
  .join('|')}`;
const DURATION = String.raw`(?:(${NUM})\s*(h|std\.?|stunden?|min\.?|minuten))`;
const MOVE = String.raw`(?:verschieb|schieb|leg)\w*`;
const TO = String.raw`(?:auf|nach)`;

const re = (src: string) => new RegExp(`^(?:${src})$`, 'u');

/** Lower case, one space, no closing punctuation; umlauts stay (the patterns accept every spelling, things are matched folded). */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.!?]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const noon = (today: string): Date => {
  const [y, m, d] = today.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12);
};

/** A day token → 'YYYY-MM-DD', through the quick-capture extractor (it reads the German words). */
export function resolveDay(token: string, today: string): string | undefined {
  const t = token
    .replace(/^am\s+/, '')
    .replace(/(?<=\p{L})\.$/u, '')
    .replace(new RegExp(`^${NEXT}`), (m) => `nächste${/[nr]$/.test(m) ? m.slice(-1) : ''}`)
    .replace(new RegExp(`^${DAY_AFTER}$`), 'übermorgen')
    .replace(new RegExp(`\\b(${Object.keys(SHORT).join('|')})$`), (m) => SHORT[m]!);
  const st = extractDateTime({ t }, noon(today));
  if (!st.date || st.notes.has('invalid-date')) return undefined;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${st.date.y}-${p(st.date.m)}-${p(st.date.d)}`;
}

/** „2 Std“, „45 Minuten“, „zwei Stunden“, „1,5 h“ → minutes. */
export function durationMin(amount: string, unit: string): number | undefined {
  const n =
    amount === 'anderthalb' || amount === 'eineinhalb'
      ? 1.5
      : amount === 'halbe'
        ? 0.5
        : (NUMBER_WORDS[amount] ?? Number(amount.replace(',', '.')));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const min = Math.round(unit.startsWith('m') ? n : n * 60);
  return min >= 1 && min <= 1440 ? min : undefined;
}

const toMin = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** „14 bis 16 Uhr Werkstatt“ → window + label (end-time extractor, then the clock-time extractor). */
function readWindow(
  rest: string,
  today: string,
): { from: string; to: string; label: string } | undefined {
  const scan = { t: rest };
  const to = extractEndTime(scan);
  if (!to) return undefined;
  const st = extractDateTime(scan, noon(today));
  if (!st.time || st.date) return undefined;
  const label = scan.t.replace(/\s+/g, ' ').trim();
  if (!label || toMin(to) <= toMin(st.time)) return undefined;
  return { from: st.time, to, label };
}

/** Words that make a sentence an instruction even when nothing else fits (then: explain, never a ToDo). */
const VERB_START = re(String.raw`(?:${MOVE}|neu verteil\w*|alles neu\b|puffer\b).*`);
/** „Dontag frei“: a misspelt day (a weekday's first letters) with the day-off words. */
const DAY_OFF_TAIL = re(
  String.raw`(?:mo|di|mi|do|fr|sa|so|mon|die|mit|don|fre|sam|son)\p{L}*\.? (?:frei|keine zeit)`,
);

const words = (s: string): string[] =>
  fold(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * Without a planning verb („Fahrrad raus“) a thing must be named word for word – each word the same
 * or one letter off (`withinOneEdit`), never a mere prefix: „Müll raus“ is a ToDo, not „Müller anrufen“.
 */
const namesExactly = (query: string, title: string): boolean => {
  const t = words(title);
  return words(query).every((q) =>
    t.some((w) => w === q || (q.length >= 5 && w.length >= 5 && withinOneEdit(q, w))),
  );
};

/** Matching a thing: one clear → it, several → ask, none → undefined. */
function target(
  query: string,
  items: readonly InstructionItem[],
  strict: boolean,
): { key: string } | { ask: { key: string; title: string }[] } | undefined {
  const found = pickTarget(
    items
      .filter((i) => !strict || namesExactly(query, i.title))
      .map((i) => ({ id: i.key, title: i.title })),
    query,
  );
  if (found.match) return { key: found.match.id };
  if (found.candidates.length > 1)
    return { ask: found.candidates.slice(0, 2).map((c) => ({ key: c.id, title: c.title })) };
  return undefined;
}

/** One thing + the ops for it; `explicit` = a planning verb was there (a missing thing is said, not made a ToDo). */
function forThing(
  query: string,
  ctx: InstructionContext,
  make: (key: string) => PlanOp[],
  explicit: boolean,
): Instruction {
  const q = query.replace(/^(?:das|die|den|der)\s+/, '').trim();
  const hit = q ? target(q, ctx.items, !explicit) : undefined;
  if (!hit) return explicit ? { kind: 'missing', query: q } : { kind: 'none' };
  if ('key' in hit) return { kind: 'ops', ops: make(hit.key) };
  return { kind: 'ask', options: hit.ask, ops: make };
}

/** Next Monday after `today` (the start of „nächste Woche“). */
function nextMonday(today: string): string {
  const d = new Date(`${today}T00:00:00Z`).getUTCDay();
  const iso = d === 0 ? 7 : d;
  return addDays(today, 8 - iso);
}

/** „alles von Do nach Fr“: Do is free, its things not before Fr – a hard due before Fr stays first. */
function moveAll(a: string, b: string, ctx: InstructionContext): PlanOp[] {
  return [
    { op: 'available', date: a, min: 0 },
    ...ctx.items
      .filter((i) => i.date === a && !(i.hardDue && i.hardDue < b))
      .map((i): PlanOp => ({ op: 'earliest', key: i.key, date: b })),
  ];
}

/** The sentence → an instruction (German only, like the quick-capture parser). */
export function parseInstruction(text: string, ctx: InstructionContext): Instruction {
  const s = normalize(text);
  if (!s) return { kind: 'none' };
  const day = (token: string) => resolveDay(token, ctx.today);
  let m: RegExpExecArray | null;

  // Runs.
  if (re(String.raw`(?:alles )?neu (?:mischen|durchmischen)`).test(s))
    return { kind: 'ops', ops: [{ op: 'replan', reshuffle: true }] };
  if (re(String.raw`(?:alles )?neu verteilen|neu planen`).test(s))
    return { kind: 'ops', ops: [{ op: 'replan', reshuffle: false }] };
  if ((m = re(String.raw`puffer (?:auf )?(\d{1,2}) ?(?:%|prozent)`).exec(s))) {
    const pct = Number(m[1]);
    return (BUFFER_STEPS as readonly number[]).includes(pct)
      ? { kind: 'ops', ops: [{ op: 'buffer', pct }] }
      : { kind: 'explain' };
  }

  // Everything of one day to another.
  if (
    (m =
      re(String.raw`(?:${MOVE} )?alles (?:von )?(${DAY}) ${TO} (${DAY})`).exec(s) ??
      re(String.raw`(${DAY}) frei,? (?:und )?alles ${TO} (${DAY})`).exec(s))
  ) {
    const [a, b] = [day(m[1]!), day(m[2]!)];
    if (!a || !b || b <= a) return { kind: 'explain' };
    return { kind: 'ops', ops: moveAll(a, b, ctx) };
  }

  // A day: off, a number of hours, a window.
  if ((m = re(String.raw`(${DAY}) (?:ist )?(?:frei|nichts|keine zeit|ganz frei)`).exec(s))) {
    const d = day(m[1]!);
    return d ? { kind: 'ops', ops: [{ op: 'available', date: d, min: 0 }] } : { kind: 'explain' };
  }
  if ((m = re(String.raw`(${DAY}) (?:nur |noch )?${DURATION}(?: zeit)?`).exec(s))) {
    const d = day(m[1]!);
    const min = durationMin(m[2]!, m[3]!);
    if (d && min !== undefined) return { kind: 'ops', ops: [{ op: 'available', date: d, min }] };
  }
  if ((m = re(String.raw`(${DAY}) (?:von )?(\d.*)`).exec(s))) {
    const d = day(m[1]!);
    const w = d ? readWindow(m[2]!, ctx.today) : undefined;
    if (d && w) {
      // The label keeps the user's spelling (the sentence was lower-cased for the patterns).
      const at = text.toLowerCase().lastIndexOf(w.label.toLowerCase());
      w.label =
        at >= 0
          ? text.slice(at, at + w.label.length)
          : w.label.charAt(0).toUpperCase() + w.label.slice(1);
      return {
        kind: 'ops',
        ops: [{ op: 'block', date: d, ...w, min: toMin(w.to) - toMin(w.from) }],
      };
    }
  }

  // One thing.
  if ((m = re(String.raw`${MOVE} (.+?) ${TO} (${DAY})`).exec(s))) {
    const d = day(m[2]!);
    if (!d) return { kind: 'explain' };
    return forThing(m[1]!, ctx, (key) => [{ op: 'pin', key, date: d }], true);
  }
  if ((m = re(String.raw`${MOVE} (.+?) (?:erst )?(?:auf |in die )?${NEXT} woche`).exec(s)))
    return forThing(
      m[1]!,
      ctx,
      (key) => [{ op: 'earliest', key, date: nextMonday(ctx.today) }],
      true,
    );
  if ((m = re(String.raw`(.+?) erst (?:ab )?${NEXT} woche`).exec(s)))
    return forThing(
      m[1]!,
      ctx,
      (key) => [{ op: 'earliest', key, date: nextMonday(ctx.today) }],
      true,
    );
  if ((m = re(String.raw`(.+?) erst (?:ab |am )?(${DAY})`).exec(s))) {
    const d = day(m[2]!);
    if (!d) return { kind: 'explain' };
    return forThing(m[1]!, ctx, (key) => [{ op: 'earliest', key, date: d }], true);
  }
  if ((m = re(String.raw`(.+?) ${TO} (${DAY})`).exec(s))) {
    const d = day(m[2]!);
    if (d) return forThing(m[1]!, ctx, (key) => [{ op: 'pin', key, date: d }], false);
  }
  if ((m = re(String.raw`(.+?) (?:zuerst|heute|als erstes)`).exec(s)))
    return forThing(m[1]!, ctx, (key) => [{ op: 'pin', key, date: ctx.today }], false);
  if ((m = re(String.raw`(.+?) (?:ist )?(?:wichtig|dringend)`).exec(s)))
    return forThing(m[1]!, ctx, (key) => [{ op: 'priority', key, value: 3 }], false);
  if ((m = re(String.raw`(.+?) nicht (?:mehr )?(?:planen|einplanen)`).exec(s)))
    return forThing(m[1]!, ctx, (key) => [{ op: 'exclude', key }], true);
  if ((m = re(String.raw`(.+?) raus`).exec(s)))
    return forThing(m[1]!, ctx, (key) => [{ op: 'exclude', key }], false);
  if ((m = re(String.raw`(.+?) dauert (?:nur |etwa |ca )?${DURATION}`).exec(s))) {
    const min = durationMin(m[2]!, m[3]!);
    if (min === undefined) return { kind: 'explain' };
    return forThing(m[1]!, ctx, (key) => [{ op: 'duration', key, min }], true);
  }
  if ((m = re(String.raw`(.+?) ${DURATION}`).exec(s))) {
    const min = durationMin(m[2]!, m[3]!);
    if (min !== undefined)
      return forThing(m[1]!, ctx, (key) => [{ op: 'duration', key, min }], false);
  }

  // A planning verb with something the parser cannot read: say what works, never guess.
  if (VERB_START.test(s) || DAY_OFF_TAIL.test(s)) return { kind: 'explain' };
  return { kind: 'none' };
}
