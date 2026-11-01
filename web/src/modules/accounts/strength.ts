/**
 * Password strength with zxcvbn-ts (pattern based, not just length/character classes). The
 * dictionaries are large, so everything is loaded on first use in a separate chunk. They are not in the
 * service worker's precache (decision in docs/decisions/core.md): the first vault open loads them in the
 * background, the runtime cache keeps them for offline use. Never loaded and offline, measuring rejects
 * with `StrengthUnavailable` and the meter shows a calm note instead.
 */
import type { ZxcvbnResult } from '@zxcvbn-ts/core';
import { numberFormat } from '@/core/i18n/format';
import { t } from '@/strings';

export type Score = 0 | 1 | 2 | 3 | 4;

export interface Strength {
  /** Pattern score (zxcvbn), lowered to what the shown crack time supports so label and time never contradict. */
  score: Score;
  /** Estimated guesses (log10), for display and tests. */
  guessesLog10: number;
  /** Crack time of an offline attack with a fast hash, in seconds. */
  crackSeconds: number;
  /** Key of the zxcvbn warning (`straightRow`, `common`, …) or empty; the text lives in the catalogs. */
  warning: string;
}

const UNITS: [number, Intl.NumberFormatOptions['unit']][] = [
  [365 * 86400, 'year'],
  [30 * 86400, 'month'],
  [86400, 'day'],
  [3600, 'hour'],
  [60, 'minute'],
  [1, 'second'],
];

/** "3 hours" / "2 Jahre" in the format locale; very short and very long times are words from the catalog. */
export function formatCrackTime(seconds: number): string {
  const s = t.accounts.strength;
  if (seconds < 1) return s.lessThanSecond;
  if (seconds >= 100 * 365 * 86400) return s.centuries;
  const [size, unit] = UNITS.find(([n]) => seconds >= n)!;
  return numberFormat({
    style: 'unit',
    unit,
    unitDisplay: 'long',
    maximumFractionDigits: 0,
  }).format(Math.floor(seconds / size));
}

/** Strength level the shown crack time supports (offline attack, fast hash). */
export function scoreOfSeconds(seconds: number): Score {
  if (seconds < 1) return 0;
  if (seconds < 3600) return 1;
  if (seconds < 30 * 86400) return 2;
  if (seconds < 100 * 365 * 86400) return 3;
  return 4;
}

/** zxcvbn is quadratic-ish in the input length; a bounded prefix is enough to judge a password. */
const MAX_LENGTH = 100;

/** The dictionaries could not be loaded (offline before their first use); nothing was measured. */
export class StrengthUnavailable extends Error {
  constructor(cause: unknown) {
    super('password strength check unavailable', { cause });
    this.name = 'StrengthUnavailable';
  }
}

let ready: Promise<{ check(password: string, userInputs?: string[]): ZxcvbnResult }> | undefined;

async function load() {
  return (ready ??= (async () => {
    const [core, common, en, de] = await Promise.all([
      import('@zxcvbn-ts/core'),
      import('@zxcvbn-ts/language-common'),
      import('@zxcvbn-ts/language-en'),
      import('@zxcvbn-ts/language-de'),
    ]);
    // The texts live in our catalogs (five languages): the library only reports which warning applies.
    const keyed = (group: Record<string, string>) =>
      Object.fromEntries(Object.keys(group).map((k) => [k, k]));
    const translations = {
      ...en.translations,
      warnings: keyed(en.translations.warnings) as typeof en.translations.warnings,
      suggestions: keyed(en.translations.suggestions) as typeof en.translations.suggestions,
    };
    return new core.ZxcvbnFactory({
      translations,
      graphs: common.adjacencyGraphs,
      dictionary: { ...common.dictionary, ...en.dictionary, ...de.dictionary },
    });
  })().catch((e: unknown) => {
    // Not cached as failed: the next measurement (back online) tries again.
    ready = undefined;
    throw new StrengthUnavailable(e);
  }));
}

/**
 * Loads the dictionaries in the background when the vault is opened, so the meter works offline later.
 * Skipped offline and with the browser's data saver; a failure is silent (measuring tries again).
 */
export function preloadStrength(): void {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const saveData = (nav as (Navigator & { connection?: { saveData?: boolean } }) | undefined)
    ?.connection?.saveData;
  if (nav?.onLine === false || saveData) return;
  void load().catch(() => undefined);
}

export async function measureStrength(
  password: string,
  userInputs: string[] = [],
): Promise<Strength> {
  const result = (await load()).check(password.slice(0, MAX_LENGTH), userInputs);
  // zxcvbn's "offline, fast hash" scenario: 10^10 guesses per second.
  const crackSeconds = result.guesses / 1e10;
  return {
    score: Math.min(result.score, scoreOfSeconds(crackSeconds)) as Score,
    guessesLog10: result.guessesLog10,
    crackSeconds,
    warning: result.feedback.warning ?? '',
  };
}
