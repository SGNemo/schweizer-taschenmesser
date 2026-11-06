/**
 * Prompt, grammar and answer parser of the planner's local stage (docs/design/plan/CONCEPT.md §6b,
 * stage 1). The planner has no `aiSchema`: this prompt is its own, independent of the entry
 * prompt (`v1.ts`), of `aiModules()` and of `core/ai/write`. The model sees the compact plan (key,
 * title, minutes, priority, due, day – at most `MAX_PLAN_LINES` things), a short day list and the
 * sentence, and may only answer with ops the grammar allows; the keys are the plan's own short keys,
 * so an unknown thing cannot even be spelled. Nothing leaves the device, and nothing is written: the
 * ops end in the planner's preview like every stage-0 instruction. Versioned like `v1.ts`: a change
 * here is a new version and a new measurement.
 */
import { z } from 'zod';
import type { PlanOp } from '@/core/plan/instructions';
import { addDays } from '@/core/plan/dates';
import { isCalendarDate } from '@/core/time/dates';

export const PLAN_PROMPT_VERSION = 1;

/** Things the model may see and name; the rules still reach everything beyond. */
export const MAX_PLAN_LINES = 30;
export const MAX_PLAN_OPS = 8;
/** Days listed with their weekday (a small model is bad at calendar arithmetic). */
export const PLAN_DAYS = 14;
/** The grammar bounds every answer; 8 ops × ~40 tokens. */
export const PLAN_MAX_TOKENS = 360;
/** A day the model names may lie this far ahead; the engine's horizon is shorter anyway. */
const MAX_DAYS_AHEAD = 365;
/** Longest duration the model may set: the ToDo estimate's own cap (`todos/schema.ts`). */
const MAX_DURATION_MIN = 480;
const MAX_TITLE = 48;
const MAX_SENTENCE = 200;

/** One thing of the plan as the model sees it. */
export interface PlanLine {
  /** The planner's item key (`<module>:<id>`); the model only ever sees `k<n>`. */
  key: string;
  title: string;
  min: number;
  /** 0–3 */
  prio: number;
  /** Hard due, if any. */
  due?: string;
  /** The first day it is planned on; absent = waits. */
  day?: string;
  /** „Nicht planen“: the model sees it, so it does not pin or exclude it again blindly. */
  excluded?: boolean;
}

const WEEKDAY = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
const weekdayOf = (date: string): string =>
  WEEKDAY[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7]!;
const WEEKDAY_LONG: Record<string, string> = {
  Mo: 'Montag',
  Di: 'Dienstag',
  Mi: 'Mittwoch',
  Do: 'Donnerstag',
  Fr: 'Freitag',
  Sa: 'Samstag',
  So: 'Sonntag',
};

/** Planned things by day first, then the waiting ones; cut to `MAX_PLAN_LINES`. */
export function compactPlan(lines: readonly PlanLine[]): PlanLine[] {
  return [...lines]
    .sort((a, b) => (a.day ?? '9').localeCompare(b.day ?? '9'))
    .slice(0, MAX_PLAN_LINES);
}

const alias = (i: number): string => `k${i + 1}`;
const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim();
const cut = (s: string, max: number): string =>
  s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;

/** `k3 | Steuer | 120 min | prio 2 | due 2026-11-12 | day Do 2026-11-12` */
export function planText(lines: readonly PlanLine[]): string {
  return lines
    .map((l, i) =>
      [
        alias(i),
        cut(oneLine(l.title), MAX_TITLE) || '–',
        `${Math.max(0, Math.round(l.min))} min`,
        `prio ${Math.max(0, Math.min(3, Math.round(l.prio)))}`,
        l.due ? `due ${l.due}` : undefined,
        l.day ? `day ${weekdayOf(l.day)} ${l.day}` : l.excluded ? 'excluded' : 'waits',
      ]
        .filter(Boolean)
        .join(' | '),
    )
    .join('\n');
}

/** `Mo 2026-11-09, Di 2026-11-10, …` for the next two weeks, so a weekday word has one clear date. */
export function dayList(today: string, days = PLAN_DAYS): string {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i);
    return `${weekdayOf(date)} ${date}`;
  }).join(', ');
}

/** The examples show this day; the user message of a real request carries the real one. */
export const EXAMPLE_TODAY = '2026-11-09';

const EXAMPLE_PLAN: PlanLine[] = [
  { key: 'todos:a', title: 'Steuer', min: 120, prio: 2, due: '2026-11-12', day: '2026-11-09' },
  { key: 'todos:b', title: 'Keller aufräumen', min: 60, prio: 0, day: '2026-11-10' },
  { key: 'todos:c', title: 'Blogpost schreiben', min: 90, prio: 1 },
];

const EXAMPLES: { sentence: string; ops: unknown[] }[] = [
  {
    sentence: 'schieb die Steuererklärung auf Freitag',
    ops: [{ op: 'pin', key: 'k1', value: '2026-11-13' }],
  },
  {
    sentence: 'Mittwoch nur zwei Stunden',
    ops: [{ op: 'available', date: '2026-11-11', value: 120 }],
  },
  { sentence: 'Keller nicht mehr planen', ops: [{ op: 'exclude', key: 'k2', value: true }] },
  {
    sentence: 'Donnerstag frei und den Blogpost auf Dienstag',
    ops: [
      { op: 'available', date: '2026-11-12', value: 0 },
      { op: 'pin', key: 'k3', value: '2026-11-10' },
    ],
  },
  {
    sentence: 'Do 14 bis 16 Uhr Werkstatt',
    ops: [{ op: 'block', date: '2026-11-12', value: '14:00-16:00 Werkstatt' }],
  },
  { sentence: 'Friseur anrufen bis Freitag', ops: [] },
];

/** Role, ops, rules, examples: the stable prefix of every request (the KV cache keeps it). */
export function planSystemPrompt(): string {
  const examples = EXAMPLES.map(
    (e) =>
      `${planUserMessage(EXAMPLE_PLAN, e.sentence, EXAMPLE_TODAY)}\nAusgabe: ${JSON.stringify({ ops: e.ops })}`,
  ).join('\n\n');
  return [
    'You turn one German sentence about a personal week plan into JSON ops for the planner. Answer with the JSON only.',
    'The plan lists things: key (k1, k2, …), title, minutes, priority 0-3, hard due date, and the day it is planned on ("waits" = not placed yet).',
    `Ops (at most ${MAX_PLAN_OPS}):`,
    '- {"op":"pin","key":K,"value":"YYYY-MM-DD"} nail a thing to a day („schieb Steuer auf Freitag“, „Steuer lieber am Freitag“, „Steuer zuerst“ = today).',
    '- {"op":"exclude","key":K,"value":true} leave a thing out of the plan („Keller nicht mehr planen“, „Keller raus“).',
    '- {"op":"priority","key":K,"value":3} a thing is important or urgent.',
    '- {"op":"duration","key":K,"value":MINUTES} how long a thing takes („Steuer dauert nur eine Stunde“ = 60).',
    '- {"op":"available","date":"YYYY-MM-DD","value":MINUTES} minutes of a day for planned work; 0 = a day off („Donnerstag frei“, „Mittwoch nur zwei Stunden“ = 120).',
    '- {"op":"block","date":"YYYY-MM-DD","value":"HH:MM-HH:MM Label"} a stretch of a day that is taken („Do 14 bis 16 Uhr Werkstatt“).',
    'Rules:',
    '- "key" is the thing of the plan the sentence names, also with another spelling, ending or a shorter name. Only keys from the plan; never invent a thing.',
    '- Dates only from the day list; a weekday word means the next such day from today.',
    '- A new task to add, a question, or anything that is not an instruction about the plan: answer {"ops":[]}.',
    '- Unsure which thing is meant: answer {"ops":[]}.',
    'Examples:',
    examples,
  ].join('\n');
}

/** Today, the day list, the compact plan, the sentence (in this order, so the sentence comes last). */
export function planUserMessage(
  lines: readonly PlanLine[],
  sentence: string,
  today: string,
): string {
  return [
    `Heute: ${today} (${WEEKDAY_LONG[weekdayOf(today)]})`,
    `Tage: ${dayList(today)}`,
    'Plan:',
    lines.length > 0 ? planText(lines) : '(leer)',
    `Satz: ${cut(oneLine(sentence), MAX_SENTENCE)}`,
  ].join('\n');
}

const lit = (s: string): string => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
/** A JSON key with its colon, as a grammar literal: `"\"op\":"`. */
const jkey = (name: string): string => lit(`"${name}":`);

/**
 * GBNF grammar: `{"ops":[…]}` with at most `MAX_PLAN_OPS` ops of the six kinds, keys only from the
 * plan (`k1`…`kN`), dates in shape, minutes bounded in length. Every repetition is bounded, so an
 * answer always ends. Without any thing in the plan only the day ops exist.
 */
export function buildPlanGrammar(count: number): string {
  const n = Math.max(0, Math.min(MAX_PLAN_LINES, Math.floor(count)));
  const keyed = n > 0;
  const keys = Array.from({ length: n }, (_, i) => lit(`"${alias(i)}"`)).join(' | ');
  const head = (op: string): string => `"{" ${jkey('op')} ${lit(`"${op}"`)} ","`;
  const rules = [
    `root ::= "{" ${jkey('ops')} "[" (op ("," op){0,${MAX_PLAN_OPS - 1}})? "]}"`,
    `op ::= ${[...(keyed ? ['pin', 'exclude', 'priority', 'duration'] : []), 'available', 'block'].join(' | ')}`,
    ...(keyed
      ? [
          `pin ::= ${head('pin')} ${jkey('key')} key "," ${jkey('value')} date "}"`,
          `exclude ::= ${head('exclude')} ${jkey('key')} key "," ${jkey('value')} "true}"`,
          `priority ::= ${head('priority')} ${jkey('key')} key "," ${jkey('value')} "3}"`,
          `duration ::= ${head('duration')} ${jkey('key')} key "," ${jkey('value')} minutes "}"`,
          `key ::= ${keys}`,
        ]
      : []),
    `available ::= ${head('available')} ${jkey('date')} date "," ${jkey('value')} minutes0 "}"`,
    `block ::= ${head('block')} ${jkey('date')} date "," ${jkey('value')} "\\"" time "-" time " " label "\\"}"`,
    `date ::= "\\"" [0-9]{4} "-" [0-9]{2} "-" [0-9]{2} "\\""`,
    `minutes ::= [1-9] [0-9]{0,3}`,
    `minutes0 ::= "0" | [1-9] [0-9]{0,3}`,
    `time ::= [0-2] [0-9] ":" [0-5] [0-9]`,
    `label ::= [^"\\\\\\x00-\\x1f]{1,40}`,
  ];
  return rules.join('\n');
}

const answerSchema = z.object({
  ops: z
    .array(
      z.discriminatedUnion('op', [
        z.object({ op: z.literal('pin'), key: z.string(), value: z.string() }),
        z.object({ op: z.literal('exclude'), key: z.string(), value: z.literal(true) }),
        z.object({ op: z.literal('priority'), key: z.string(), value: z.literal(3) }),
        z.object({ op: z.literal('duration'), key: z.string(), value: z.number().int() }),
        z.object({ op: z.literal('available'), date: z.string(), value: z.number().int() }),
        z.object({ op: z.literal('block'), date: z.string(), value: z.string() }),
      ]),
    )
    .max(MAX_PLAN_OPS),
});

const BLOCK_RE = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d) (.{1,40})$/;
const toMin = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/**
 * The model's text → ops for the engine, or `undefined` when anything is off: not the JSON the
 * grammar promises, a key outside the plan, a date that is no day or lies behind today, a minute
 * value out of range, a window that does not run forward. One bad op spoils the answer (the planner
 * then falls back to the rules); an empty list is a valid "this is no instruction".
 */
export function parsePlanAnswer(
  text: string,
  lines: readonly PlanLine[],
  today: string,
): PlanOp[] | undefined {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return undefined;
  }
  const parsed = answerSchema.safeParse(json);
  if (!parsed.success) return undefined;
  const keyOf = (k: string): string | undefined => {
    const m = /^k(\d{1,2})$/.exec(k);
    const i = m ? Number(m[1]) - 1 : -1;
    return lines[i]?.key;
  };
  const latest = addDays(today, MAX_DAYS_AHEAD);
  const dayOk = (d: string): boolean => isCalendarDate(d) && d >= today && d <= latest;
  const out: PlanOp[] = [];
  for (const op of parsed.data.ops) {
    switch (op.op) {
      case 'pin': {
        const key = keyOf(op.key);
        if (!key || !dayOk(op.value)) return undefined;
        out.push({ op: 'pin', key, date: op.value });
        break;
      }
      case 'exclude': {
        const key = keyOf(op.key);
        if (!key) return undefined;
        out.push({ op: 'exclude', key });
        break;
      }
      case 'priority': {
        const key = keyOf(op.key);
        if (!key) return undefined;
        out.push({ op: 'priority', key, value: 3 });
        break;
      }
      case 'duration': {
        const key = keyOf(op.key);
        if (!key || op.value < 1 || op.value > MAX_DURATION_MIN) return undefined;
        out.push({ op: 'duration', key, min: op.value });
        break;
      }
      case 'available':
        if (!dayOk(op.date) || op.value < 0 || op.value > 1440) return undefined;
        out.push({ op: 'available', date: op.date, min: op.value });
        break;
      case 'block': {
        const m = BLOCK_RE.exec(op.value);
        if (!m || !dayOk(op.date)) return undefined;
        const from = `${m[1]}:${m[2]}`;
        const to = `${m[3]}:${m[4]}`;
        const label = oneLine(m[5]!);
        if (!label || toMin(to) <= toMin(from)) return undefined;
        out.push({ op: 'block', date: op.date, from, to, min: toMin(to) - toMin(from), label });
        break;
      }
    }
  }
  return out;
}
