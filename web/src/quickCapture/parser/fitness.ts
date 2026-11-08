/**
 * Fitness captures (docs/features/fitness.md §5): `kcal 650 Döner` / `Döner 650 kcal` → a meal,
 * `training Bankdrücken 3×8 60, Kniebeuge 3×5 80` → a session with exercises. Pure, local.
 */
import type { CaptureExercise, CaptureResult, ParseOptions } from './types';
import { addDays, fmtDate, fmtTime, fromDate, word } from './util';

/** Word prefixes (the one letters are taken): German and English. */
export const MEAL_PREFIX = /^\s*(?:kcal|essen|meal)\s*:?\s+/i;
export const WORKOUT_PREFIX = /^\s*(?:training|workout)\s*:?\s+/i;

/** "650 kcal", "650kcal": an unambiguous meal signal, also without a prefix. */
const KCAL_RE = /(?<![\p{L}\d.,])(\d{1,4})\s*kcal(?!\p{L})/iu;
const BARE_NUMBER = /(?<![\p{L}\d.,×x*])(\d{1,4})(?![\p{L}\d.,×x*])/iu;
const DAY_WORDS: [RegExp, number][] = [
  [word('vorgestern'), -2],
  [word('gestern|yesterday'), -1],
  [word('heute|today'), 0],
];

const SETS_REPS = /(?<!\d)(\d{1,2})\s*[x×*]\s*(\d{1,3})(?!\d)/i;
const WEIGHT_KG = /(?<![\d.,])(\d{1,4}(?:[.,]\d{1,2})?)\s*kg(?!\p{L})/iu;
const MINUTES = /(?<![\d.,])(\d{1,3})\s*(?:min(?:uten|utes)?|m)(?!\p{L})/iu;
const HOURS = /(?<![\d.,])(\d{1,2}(?:[.,]\d)?)\s*(?:h|std\.?|stunden?|hours?)(?!\p{L})/iu;
/** The weight without "kg" after sets × reps: "3×8 60", "3x8 @ 60". */
const TRAILING_WEIGHT = /(?:@\s*)?(?<![\d.,])(\d{1,4}(?:[.,]\d{1,2})?)(?![\d.,\p{L}])/u;
/** Exercises are cut at „;“, „und“ and commas that are no decimal comma („72,5 kg“ stays). */
const PARTS = /\s*;\s*|\s*(?<!\d),\s*|\s*,(?!\d)\s*|\s+(?:und|and)\s+/i;
/** A day word in front of the prefix: „gestern kcal 400 Pizza“. */
const LEADING_DAY = /^\s*(vorgestern|gestern|heute|yesterday|today)\s+/i;

const num = (s: string) => Number(s.replace(',', '.'));
const clean = (s: string) =>
  s
    .replace(/[@:–-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toLocaleUpperCase());

/** Takes a day word out of the text; the day it names (today when none). */
function takeDay(text: string, opts: ParseOptions): { text: string; date: string; today: boolean } {
  const now = fromDate(opts.now);
  for (const [re, offset] of DAY_WORDS) {
    const m = re.exec(text);
    if (m) {
      const rest = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`;
      return { text: rest, date: fmtDate(addDays(now, offset)), today: offset === 0 };
    }
  }
  return { text, date: fmtDate(now), today: true };
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
  const m = KCAL_RE.exec(text) ?? (forced ? BARE_NUMBER.exec(text) : null);
  if (!m) return undefined;
  text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`;
  const title = clean(text.replace(/\bkcal\b/gi, ' '));
  if (!title) return undefined;
  return result('meal', forced, {
    title,
    kcal: Number(m[1]),
    date: day.date,
    ...(day.today ? { time: fmtTime(opts.now.getHours(), opts.now.getMinutes()) } : {}),
  });
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
    out.sets = Number(sr[1]);
    out.reps = Number(sr[2]);
    cut(sr);
  }
  const kg = WEIGHT_KG.exec(t);
  if (kg) {
    out.weightKg = num(kg[1]!);
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
  if (sr && out.weightKg === undefined) {
    const w = TRAILING_WEIGHT.exec(t);
    if (w) {
      out.weightKg = num(w[1]!);
      cut(w);
    }
  }
  const name = clean(t);
  if (!name) return undefined;
  return { name, ...out };
}

function parseWorkout(input: string, opts: ParseOptions): CaptureResult | undefined {
  const day = takeDay(input, opts);
  const exercises = day.text
    .split(PARTS)
    .map(parseExercise)
    .filter((e): e is CaptureExercise => !!e);
  if (exercises.length === 0) return undefined;
  return result('workout', true, {
    title: exercises.map((e) => e.name).join(', '),
    exercises,
    date: day.date,
    ...(day.today ? { time: fmtTime(opts.now.getHours(), opts.now.getMinutes()) } : {}),
  });
}

/** A fitness capture, or `undefined` when the text is none (the general parser then runs). */
export function parseFitness(input: string, opts: ParseOptions): CaptureResult | undefined {
  const lead = LEADING_DAY.exec(input);
  if (lead) {
    const rest = input.slice(lead[0].length);
    if (WORKOUT_PREFIX.test(rest) || MEAL_PREFIX.test(rest))
      return parseFitness(`${rest.replace(/\s+$/, '')} ${lead[1]}`, opts);
  }
  const workout = WORKOUT_PREFIX.exec(input);
  if (workout) return parseWorkout(input.slice(workout[0].length), opts);
  const meal = MEAL_PREFIX.exec(input);
  if (meal) return parseMeal(input.slice(meal[0].length), true, opts);
  if (KCAL_RE.test(input)) return parseMeal(input, false, opts);
  return undefined;
}
