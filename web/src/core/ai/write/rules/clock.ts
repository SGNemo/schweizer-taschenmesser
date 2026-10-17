/**
 * Settles a clock time the user said for a reminder: "um 3" at 10:00 means 15:00, a time that is over
 * for today means tomorrow. Deterministic and based on `now`; the preview shows the result and says
 * when the day was moved.
 */
import { addDaysStr, toEpoch } from '@/core/time/dates';

export interface SettledClock {
  date: string | undefined;
  time: string;
  /** The day was moved to tomorrow because the time of day was already over. */
  rolled: boolean;
}

export function settleClock(
  input: { date?: string; time: string; twelveHour?: boolean; relative?: boolean },
  now: Date,
  today: string,
): SettledClock {
  const keep: SettledClock = { date: input.date, time: input.time, rolled: false };
  if (input.relative || (input.date !== undefined && input.date !== today)) return keep;
  const nowMs = now.getTime();
  if (toEpoch(today, input.time) > nowMs) return keep;
  const h = Number(input.time.slice(0, 2));
  if (input.twelveHour && h >= 1 && h < 12) {
    const pm = `${String(h + 12).padStart(2, '0')}${input.time.slice(2)}`;
    if (toEpoch(today, pm) > nowMs) return { ...keep, time: pm };
  }
  // An explicit "heute" stays today (the preview warns); without a day the next one is meant.
  return input.date === undefined ? { ...keep, date: addDaysStr(today, 1), rolled: true } : keep;
}

const VERB_START =
  /^(?:ab|an|auf|aus|ein|mit|raus|rein|weg|zuruck|zurueck|vor|nach|hoch|runter|durch|um|zu)[a-z]{3,}(?:en|ern|eln)$/;
const VERBS = new Set(
  (
    'kaufen holen schicken senden bezahlen putzen waschen melden buchen bestellen bringen trinken ' +
    'essen gehen denken schreiben lesen lernen loeschen kuendigen giessen lueften ueberweisen ' +
    'kochen backen einnehmen telefonieren trainieren packen tanken wechseln'
  ).split(' '),
);

/**
 * "Zahnarzt anrufen", "Pizza rausnehmen": an errand for oneself, which is a reminder rather than an
 * appointment. A lower-case infinitive at the end after a capitalised word, or a known verb.
 */
export function looksLikeErrand(title: string, folded: (s: string) => string): boolean {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const last = words[words.length - 1];
  if (!last || words.length < 2) return false;
  if (!/^\p{Ll}[\p{L}]{3,}(?:en|ern|eln)$/u.test(last)) return false;
  const n = folded(last);
  const hasNoun = words.slice(0, -1).some((w) => /^\p{Lu}/u.test(w));
  return VERB_START.test(n) || VERBS.has(n) || hasNoun;
}
