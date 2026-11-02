/** Integer views for the programmer mode: word sizes, two's complement, bases 2/8/10/16 (BigInt, exact). */

export const WORD_SIZES = [8, 16, 32, 64] as const;
export type WordSize = (typeof WORD_SIZES)[number];

const mask = (size: WordSize): bigint => (1n << BigInt(size)) - 1n;

/** The value as an unsigned word of `size` bits (negative numbers wrap: two's complement). */
export const toWord = (value: bigint, size: WordSize): bigint => value & mask(size);

/** The same word read as signed or unsigned. */
export const readWord = (word: bigint, size: WordSize, signed: boolean): bigint =>
  signed && word >> BigInt(size - 1) === 1n ? word - (1n << BigInt(size)) : word;

export interface IntegerView {
  hex: string;
  dec: string;
  oct: string;
  bin: string;
  /** Does the original value fit the word without wrapping? */
  fits: boolean;
}

/** Grouped by 4 bits so 32 or 64 bits stay readable. */
const group = (s: string, n: number): string =>
  s.replace(new RegExp(`(?=(?:.{${n}})+$)`, 'g'), ' ').trim();

export function viewInteger(value: bigint, size: WordSize, signed: boolean): IntegerView {
  const word = toWord(value, size);
  const lo = signed ? -(1n << BigInt(size - 1)) : 0n;
  const hi = signed ? (1n << BigInt(size - 1)) - 1n : mask(size);
  return {
    hex: group(
      word
        .toString(16)
        .toUpperCase()
        .padStart(size / 4, '0'),
      4,
    ),
    dec: readWord(word, size, signed).toString(),
    oct: word.toString(8),
    bin: group(word.toString(2).padStart(size, '0'), 4),
    fits: value >= lo && value <= hi,
  };
}

/** A canonical calculator result ("255", "-6", "1e+3") as an integer; undefined when it is not one. */
export function toInteger(canonical: string): bigint | undefined {
  const s = canonical.trim();
  if (/^-?[0-9]+$/.test(s)) return BigInt(s);
  const m = /^(-?[0-9]+)(?:\.([0-9]+))?e\+?([0-9]+)$/i.exec(s);
  if (!m) return undefined;
  const frac = m[2] ?? '';
  const exp = Number(m[3]);
  if (frac.length > exp || exp > 400) return undefined;
  return BigInt(m[1]! + frac.padEnd(exp, '0'));
}

export type BaseName = 'hex' | 'dec' | 'oct' | 'bin';

/** "0x1F", "0b101", "0o17" or a decimal; undefined for anything else. */
export function parseLiteral(text: string): bigint | undefined {
  const s = text.trim().replace(/[_\s]/g, '').toLowerCase();
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  let v: bigint | undefined;
  if (/^0x[0-9a-f]+$/.test(body)) v = BigInt(body);
  else if (/^0b[01]+$/.test(body)) v = BigInt(body);
  else if (/^0o[0-7]+$/.test(body)) v = BigInt(body);
  else if (/^[0-9]+$/.test(body)) v = BigInt(body);
  return v === undefined ? undefined : neg ? -v : v;
}

const BASE_WORDS: Record<string, BaseName> = {
  hex: 'hex',
  hexadezimal: 'hex',
  hexadecimal: 'hex',
  dez: 'dec',
  dezimal: 'dec',
  dec: 'dec',
  decimal: 'dec',
  oct: 'oct',
  okt: 'oct',
  oktal: 'oct',
  octal: 'oct',
  bin: 'bin',
  binär: 'bin',
  binary: 'bin',
  binaire: 'bin',
  binario: 'bin',
  binário: 'bin',
};
const CONVERT = /^(-?[0-9a-fx_]+)\s+(?:in|to|als|en|a|para|como)\s+([a-zäöü]+)$/i;

/** "0x1F in dez" → "0x1F = 31". Pure integers only; the caller keeps decimals for the calculator. */
export function baseConversion(query: string): { text: string; copy: string } | undefined {
  const m = CONVERT.exec(query.trim().replace(/^=\s*/, ''));
  if (!m) return undefined;
  const target = BASE_WORDS[m[2]!.toLowerCase()];
  const v = parseLiteral(m[1]!);
  if (!target || v === undefined) return undefined;
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const body =
    target === 'hex'
      ? `0x${abs.toString(16).toUpperCase()}`
      : target === 'bin'
        ? `0b${abs.toString(2)}`
        : target === 'oct'
          ? `0o${abs.toString(8)}`
          : abs.toString(10);
  const out = neg ? `-${body}` : body;
  return { text: `${m[1]} = ${out}`, copy: out };
}
