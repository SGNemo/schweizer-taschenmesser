/**
 * The deadline phrase of the planner's field (CONCEPT §1): „bis Do“ / „Frist Do“ / „bis Donnerstag“.
 * The quick-capture parser reads full weekday names; the short German forms are resolved here and
 * taken out of the text, so the ToDo's title stays clean. Pure; `today` is 'YYYY-MM-DD'.
 */
import { addDays } from '@/core/plan/dates';
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
 * quick-capture target writes it). `de` = the phrase is read (German only, like the parser).
 */
export function readField(
  text: string,
  now: Date,
  today: string,
  de: boolean,
): { fields: CaptureFields; hardDue?: string } {
  const phrase = de ? extractDuePhrase(text, today) : { text, hasDueWord: false };
  const parsed = parseCapture(phrase.text, { now, defaultType: 'todo' });
  const hardDue = phrase.date ?? (phrase.hasDueWord ? parsed.fields.date : undefined);
  const fields: CaptureFields = { ...parsed.fields };
  // The deadline is the ToDo's date too, so the ToDo page shows the same day as the planner.
  if (phrase.date) fields.date = phrase.date;
  else if (hardDue && !fields.date) fields.date = hardDue;
  return { fields, hardDue };
}
