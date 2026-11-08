/**
 * Fitness captures (docs/features/fitness.md §5): `kcal 650 Döner` / `Döner 650 kcal` → a meal,
 * `training Bankdrücken 3×8 60, Kniebeuge 3×5 80` → a session with exercises. Pure, local. Runs only
 * when the caller can save fitness entries (`ParseOptions.fitness`) and gives way to the general
 * parser whenever the text names a time or a day it does not read („Essen mit Anna Freitag 19 Uhr“).
 */
import type { CaptureExercise, CaptureResult, ParseOptions } from './types';
import { addDays, fmtDate, fromDate, word } from './util';

/** Word prefixes (the one letters are taken): German and English. */
export const MEAL_PREFIX = /^\s*(?:kcal|meal)\s*:?\s+/i;
export const WORKOUT_PREFIX = /^\s*(?:training|workout)\s*:?\s+/i;

/** "650 kcal", "650kcal": an unambiguous meal signal, also without a prefix. */
const KCAL_RE = /(?<![\p{L}\d.,:])(\d{1,4})\s*kcal(?!\p{L})/iu;
const BARE_NUMBER = /(?<![\p{L}\d.,:×x*])(\d{1,4})(?![\p{L}\d.,:×x*])/giu;
const DAY_WORDS: [RegExp, number][] = [
  [word('vorgestern'), -2],
  [word('gestern|yesterday'), -1],
  [word(String.raw`heute(?:\s+(?:morgen|früh|mittag|abend))?|today`), 0],
];
/** Times and days this parser does not read: the text is then no fitness capture. */
const FOREIGN_WHEN = word(
  String.raw`\d{1,2}\s*uhr|\d{1,2}:\d{2}|(?<!heute\s+)morgen|übermorgen|tomorrow|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|\d{1,2}\.\d{1,2}\.(?:\d{2,4})?`,
);

const SETS_REPS = /(?<!\d)(\d{1,2})\s*[x×*]\s*(\d{1,3})(?!\d)/i;
const WEIGHT_KG = /(?<![\d.,])(\d{1,4}(?:[.,]\d{1,2})?)\s*kg(?!\p{L})/iu;
const MINUTES = /(?<![\d.,])(\d{1,3})\s*(?:min(?:uten|utes)?|m)(?!\p{L})/iu;
const HOURS = /(?<![\d.,])(\d{1,2}(?:[.,]\d)?)\s*(?:h|std\.?|stunden?|hours?)(?!\p{L})/iu;
/** The weight without "kg" after sets × reps: "3×8 60", "3x8 @ 60". */
const TRAILING_WEIGHT = /(?:@\s*)?(?<![\d.,])(\d{1,4}(?:[.,]\d{1,2})?)(?![\d.,\p{L}])/u;
/** Exercises are cut at „;“, „und“ and commas that are no decimal comma („72,5 kg“ stays). */
const PARTS = /\s*;\s*|\s*(?<!\d),\s*|\s*,(?!\d)\s*|\s+(?:und|and)\s+/i;
/** A day word in front of the prefix: „gestern kcal 400 Pizza“. */
const LEADING_DAY =
  /^\s*(vorgestern|gestern|heute(?:\s+(?:morgen|früh|mittag|abend))?|yesterday|today)\s+/i;

/** Bounds of the module's schema; a value outside is dropped, never saved half-valid. */
const within = (v: number, max: number, min = 1) => (v >= min && v <= max ? v : undefined);
const num = (s: string) => Number(s.replace(',', '.'));
const clean = (s: string) =>
  s
    .replace(/[@:–-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toLocaleUpperCase());

/** Takes a day word out of the text; the day only when one was typed (else the adapter says today). */
function takeDay(text: string, opts: ParseOptions): { text: string; date?: string } {
  for (const [re, offset] of DAY_WORDS) {
    const m = re.exec(text);
    if (m) {
      const rest = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`;
      return { text: rest, date: fmtDate(addDays(fromDate(opts.now), offset)) };
    }
  }
  return { text };
}

function result(
  type: 'meal' | 'workout',
  forced: boolean,
  fields: CaptureResult['fields'],
): CaptureResult {
  return {
    type,
    fields,
    confidence: forced ? 1 : 0.93,
    needsChoice: false,
    forced,
    alternatives: forced ? [] : [{ type: 'todo', confidence: 0.4 }],
    notes: [],
  };
}

function parseMeal(input: string, forced: boolean, opts: ParseOptions): CaptureResult | undefined {
  const day = takeDay(input, opts);
  let text = day.text;
  // „650 kcal“ wins; without the unit exactly one plain number („kcal Döner 650“), never a guess.
  let m = KCAL_RE.exec(text);
  if (!m && forced) {
    // Every digit run counts („Döner 650, Cola 140“ is two numbers, so no guess).
    if ((text.match(/\d+/g) ?? []).length === 1) m = [...text.matchAll(BARE_NUMBER)][0] ?? null;
  }
  if (!m) return undefined;
  const kcal = within(Number(m[1]), 9999, 0);
  text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`;
  const title = clean(text.replace(/\bkcal\b/gi, ' ')).slice(0, 120);
  if (!title || kcal === undefined) return undefined;
  return result('meal', forced, { title, kcal, ...(day.date ? { date: day.date } : {}) });
}

/** One exercise from "Bankdrücken 3×8 60", "Kniebeuge 4x6 70kg", "Laufen 30 Min". */
export function parseExercise(part: string): CaptureExercise | undefined {
  let t = ` ${part} `;
  const out: Omit<CaptureExercise, 'name'> = {};
  const cut = (m: RegExpExecArray) => {
    t = `${t.slice(0, m.index)} ${t.slice(m.index + m[0].length)}`;
  };
  const sr = SETS_REPS.exec(t);
  if (sr) {
    out.sets = within(Number(sr[1]), 50);
    out.reps = within(Number(sr[2]), 500);
    cut(sr);
  }
  const kg = WEIGHT_KG.exec(t);
  if (kg) {
    out.weightKg = within(num(kg[1]!), 1000, 0);
    cut(kg);
  }
  const h = HOURS.exec(t);
  if (h) {
    out.durationMin = Math.round(num(h[1]!) * 60);
    cut(h);
  }
  const min = MINUTES.exec(t);
  if (min) {
    out.durationMin = (out.durationMin ?? 0) + Number(min[1]);
    cut(min);
  }
  if (out.durationMin !== undefined) out.durationMin = within(out.durationMin, 1440);
  if (sr && out.weightKg === undefined) {
    const w = TRAILING_WEIGHT.exec(t);
    if (w) {
      out.weightKg = within(num(w[1]!), 1000, 0);
      cut(w);
    }
  }
  const name = clean(t).slice(0, 80);
  // A part of only numbers („70“ after „3x8 60, 70“) is no exercise.
  if (!name || !/\p{L}/u.test(name)) return undefined;
  const fields = Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
  return { name, ...fields };
}

/** At least one exercise says sets × reps, a weight or a duration: else „training buchen“ is a ToDo. */
const hasSignal = (e: CaptureExercise) =>
  e.sets !== undefined || e.weightKg !== undefined || e.durationMin !== undefined;

function parseWorkout(input: string, opts: ParseOptions): CaptureResult | undefined {
  const day = takeDay(input, opts);
  const exercises = day.text
    .split(PARTS)
    .map(parseExercise)
    .filter((e): e is CaptureExercise => !!e)
    .slice(0, 30);
  if (!exercises.some(hasSignal)) return undefined;
  return result('workout', true, {
    title: exercises.map((e) => e.name).join(', '),
    exercises,
    ...(day.date ? { date: day.date } : {}),
  });
}

/** „training Bankdrücken 3×8 60, Kniebeuge …“: a line `split.ts` keeps whole (commas separate exercises). */
export const looksLikeWorkout = (line: string): boolean =>
  WORKOUT_PREFIX.test(line) &&
  (SETS_REPS.test(line) || WEIGHT_KG.test(line) || MINUTES.test(line) || HOURS.test(line));

/** A fitness capture, or `undefined` when the text is none (the general parser then runs). */
export function parseFitness(input: string, opts: ParseOptions): CaptureResult | undefined {
  const allowed = opts.fitness ?? {};
  const lead = LEADING_DAY.exec(input);
  if (lead) {
    const rest = input.slice(lead[0].length);
    if (WORKOUT_PREFIX.test(rest) || MEAL_PREFIX.test(rest))
      return parseFitness(`${rest.replace(/\s+$/, '')} ${lead[1]}`, opts);
  }
  if (FOREIGN_WHEN.test(input)) return undefined;
  const workout = WORKOUT_PREFIX.exec(input);
  if (workout)
    return allowed.workout ? parseWorkout(input.slice(workout[0].length), opts) : undefined;
  if (!allowed.meal) return undefined;
  const meal = MEAL_PREFIX.exec(input);
  if (meal) return parseMeal(input.slice(meal[0].length), true, opts);
  if (KCAL_RE.test(input)) return parseMeal(input, false, opts);
  return undefined;
}
