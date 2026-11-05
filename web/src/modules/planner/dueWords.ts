/**
 * The deadline phrase of the planner's field (CONCEPT §1): „bis Do“ / „Frist Do“ / „bis Donnerstag“.
 * The quick-capture parser reads full weekday names; the short German forms are resolved here and
 * taken out of the text, so the ToDo's title stays clean. Pure; `today` is 'YYYY-MM-DD'.
 */
import { addDays } from '@/core/plan/dates';

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
