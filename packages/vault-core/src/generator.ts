/**
 * Password and passphrase generator. All randomness comes from `randomInt` (CSPRNG with rejection
 * sampling, no modulo bias). Selected character classes are guaranteed to appear at least once.
 */
import { csprng, shuffled, type Rng } from './random';

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/~';
const AMBIGUOUS = new Set('Il1O0o|`\'"');

export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  /** Leave out characters that are easy to confuse (Il1O0o). */
  avoidAmbiguous: boolean;
}

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 20,
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: false,
};

export const MIN_LENGTH = 8;
export const MAX_LENGTH = 128;

export function characterPools(o: PasswordOptions): string[][] {
  const keep = (set: string) => [...set].filter((c) => !o.avoidAmbiguous || !AMBIGUOUS.has(c));
  return [
    o.lower ? keep(LOWER) : [],
    o.upper ? keep(UPPER) : [],
    o.digits ? keep(DIGITS) : [],
    o.symbols ? keep(SYMBOLS) : [],
  ].filter((p) => p.length > 0);
}

export function generatePassword(
  options: PasswordOptions = DEFAULT_PASSWORD_OPTIONS,
  rng: Rng = csprng,
): string {
  const pools = characterPools(options);
  if (pools.length === 0) throw new RangeError('select at least one character class');
  if (options.length < Math.max(MIN_LENGTH, pools.length) || options.length > MAX_LENGTH) {
    throw new RangeError(`length must be ${MIN_LENGTH}..${MAX_LENGTH}`);
  }
  const all = pools.flat();
  const chars = pools.map((pool) => pool[rng.int(pool.length)]!); // one of each class …
  while (chars.length < options.length) chars.push(all[rng.int(all.length)]!);
  return shuffled(chars, rng).join(''); // … at random positions
}

/** log2 of the number of equally likely results (ignores the "each class present" constraint – conservative enough). */
export function passwordEntropyBits(options: PasswordOptions): number {
  const size = characterPools(options).flat().length;
  return size > 1 ? options.length * Math.log2(size) : 0;
}

export interface PassphraseOptions {
  words: number;
  separator: string;
  capitalize: boolean;
  /** Append one random digit to a random word. */
  includeNumber: boolean;
}

export const DEFAULT_PASSPHRASE_OPTIONS: PassphraseOptions = {
  words: 5,
  separator: '-',
  capitalize: false,
  includeNumber: false,
};

export function generatePassphrase(
  wordlist: readonly string[],
  options: PassphraseOptions = DEFAULT_PASSPHRASE_OPTIONS,
  rng: Rng = csprng,
): string {
  if (wordlist.length < 2) throw new RangeError('word list too short');
  if (options.words < 3 || options.words > 12) throw new RangeError('words must be 3..12');
  const words = Array.from({ length: options.words }, () => wordlist[rng.int(wordlist.length)]!);
  const cased = options.capitalize ? words.map((w) => w[0]!.toUpperCase() + w.slice(1)) : words;
  if (options.includeNumber) {
    const at = rng.int(cased.length);
    cased[at] = `${cased[at]}${rng.int(10)}`;
  }
  return cased.join(options.separator);
}

export const passphraseEntropyBits = (wordlistSize: number, o: PassphraseOptions): number =>
  o.words * Math.log2(wordlistSize) + (o.includeNumber ? Math.log2(o.words) + Math.log2(10) : 0);

let cached: Promise<readonly string[]> | undefined;
/** The EFF large word list (7776 words, CC BY 3.0 US – see `wordlist-notice.md` in the package root), loaded on demand. */
export function loadWordlist(): Promise<readonly string[]> {
  return (cached ??= import('./wordlist-eff-large.json').then((m) => m.default as string[]));
}
