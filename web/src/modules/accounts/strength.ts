/**
 * Password strength with zxcvbn-ts (pattern based, not just length/character classes). The
 * dictionaries are large, so everything is loaded on first use in a separate chunk.
 */
import type { ZxcvbnResult } from '@zxcvbn-ts/core';

export type Score = 0 | 1 | 2 | 3 | 4;

export interface Strength {
  score: Score;
  /** Estimated guesses (log10), for display and tests. */
  guessesLog10: number;
  /** Crack time of an offline attack with a fast hash, in words. */
  crackTime: string;
  warning: string;
}

/** zxcvbn is quadratic-ish in the input length; a bounded prefix is enough to judge a password. */
const MAX_LENGTH = 100;

let ready: Promise<{ check(password: string, userInputs?: string[]): ZxcvbnResult }> | undefined;

async function load() {
  return (ready ??= (async () => {
    const [core, common, en, de] = await Promise.all([
      import('@zxcvbn-ts/core'),
      import('@zxcvbn-ts/language-common'),
      import('@zxcvbn-ts/language-en'),
      import('@zxcvbn-ts/language-de'),
    ]);
    return new core.ZxcvbnFactory({
      translations: de.translations,
      graphs: common.adjacencyGraphs,
      dictionary: { ...common.dictionary, ...en.dictionary, ...de.dictionary },
    });
  })());
}

export async function measureStrength(
  password: string,
  userInputs: string[] = [],
): Promise<Strength> {
  const result = (await load()).check(password.slice(0, MAX_LENGTH), userInputs);
  return {
    score: result.score,
    guessesLog10: result.guessesLog10,
    crackTime: result.crackTimes.offlineFastHashingXPerSecond.display,
    warning: result.feedback.warning ?? '',
  };
}
