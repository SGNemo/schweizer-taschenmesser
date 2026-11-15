/**
 * The deadline phrase of the planner's field (CONCEPT §1): „bis Do“ / „Frist Do“ / „bis Donnerstag“.
 * The quick-capture parser reads full weekday names; the short German forms are resolved here and
 * taken out of the text, so the ToDo's title stays clean. Pure; `today` is 'YYYY-MM-DD'.
 */
import { addDays } from '@/core/plan/dates';
import type { DayPart } from '@/core/plan/types';
import { parseCapture, type CaptureFields } from '@/quickCapture/parser';

const SHORT: Record<string, number> = { mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6, so: 7 };
const LONG: Record<string, number> = {
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
  sonnabend: 6,
  sonntag: 7,
};
const PHRASE =
  /\b(bis|frist)\s+(mo|di|mi|do|fr|sa|so|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonnabend|sonntag)\b\.?/i;
/** „Frist“ or „bis“ without a day the parser can read itself („bis 12.11.“): still a deadline. */
export const DUE_WORDS = /\b(bis|frist)\b/i;

const isoWeekday = (date: string): number => {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
};

/** The next `weekday` (1 = Monday … 7 = Sunday) on or after `today`. */
export function nextWeekday(today: string, weekday: number): string {
  const diff = (weekday - isoWeekday(today) + 7) % 7;
  return addDays(today, diff);
}

/**
 * The day part of a planner-field line (package 4b, German only): „vormittags“, „nachmittags“, „abends“ or
 * „am Vormittag/Nachmittag/Abend“, taken out of the text. Only these adverb forms: „Abend mit Lisa“ or
 * „Spieleabend“ stay the title. A line that is nothing but the word keeps it (no empty ToDo).
 */
const PART_WORD =
  /(?:^|\s)(?:(vormittags|nachmittags|abends)|am\s+(vormittag|nachmittag|abend))(?=\s|$|[.,!])/i;
const PART_OF: Record<string, DayPart> = {
  vormittag: 'morning',
  nachmittag: 'afternoon',
  abend: 'evening',
};

export function extractPart(text: string): { text: string; part?: DayPart } {
  const m = PART_WORD.exec(text);
  if (!m) return { text };
  const word = (m[1] ?? m[2]!).toLowerCase().replace(/s$/, '');
  const stripped = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,!])/g, '$1')
    .trim();
  if (!stripped) return { text };
  return { text: stripped, part: PART_OF[word]! };
}

export interface DuePhrase {
  /** The text without the phrase (for the parser and the title). */
  text: string;
  /** The deadline the phrase named, if it named a weekday. */
  date?: string;
  /** A deadline word was there at all (the parser may still find the date). */
  hasDueWord: boolean;
}

export function extractDuePhrase(text: string, today: string): DuePhrase {
  const m = PHRASE.exec(text);
  if (!m) return { text, hasDueWord: DUE_WORDS.test(text) };
  const day = m[2]!.toLowerCase();
  const weekday = SHORT[day] ?? LONG[day]!;
  const stripped = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { text: stripped, date: nextWeekday(today, weekday), hasDueWord: true };
}

/**
 * What the planner field makes of a line: the ToDo's fields and the planner item's hard due. A due phrase
 * („bis So“) wins over any date the parser reads from the rest („… 18:00“ alone would read as today), so the
 * ToDo's date and the planner's deadline are always the same day. A clock time stays a note line (as the
 * quick-capture target writes it). `de` = the phrase is read (German only, like the parser). A line that starts
 * with „Pause“ or „Freizeit“ is a break (`isBreak`, German only, as in the quick capture): no ToDo, a blocker of its day.
 */
export function readField(
  text: string,
  now: Date,
  today: string,
  de: boolean,
): { fields: CaptureFields; hardDue?: string; isBreak?: true } {
  // „Pause …“ / „Freizeit …“ (package 4a): a blocker of its day, read as the quick capture reads it (German only).
  if (de) {
    const brk = parseCapture(text, { now, defaultType: 'todo', breaks: true });
    if (brk.type === 'break') return { fields: brk.fields, isBreak: true };
  }
  const phrase = de ? extractDuePhrase(text, today) : { text, hasDueWord: false };
  const parsed = parseCapture(phrase.text, { now, defaultType: 'todo' });
  const hardDue = phrase.date ?? (phrase.hasDueWord ? parsed.fields.date : undefined);
  const fields: CaptureFields = { ...parsed.fields };
  // The deadline is the ToDo's date too, so the ToDo page shows the same day as the planner.
  if (phrase.date) fields.date = phrase.date;
  else if (hardDue && !fields.date) fields.date = hardDue;
  return { fields, hardDue };
}

/**
 * The planner field's reading with the day part (package 4b): a break line („Pause … abends“) stays as the
 * quick capture reads it; any other line loses its part word before the parser, which would take „abends“
 * for 18:00 today – a part orders the day, it never sets one. The day setup keeps `readField` (no parts there).
 */
export function readFieldWithPart(
  text: string,
  now: Date,
  today: string,
  de: boolean,
): ReturnType<typeof readField> & { part?: DayPart } {
  const plain = readField(text, now, today, de);
  if (!de || plain.isBreak) return plain;
  const { text: line, part } = extractPart(text);
  return part ? { ...readField(line, now, today, de), part } : plain;
}
