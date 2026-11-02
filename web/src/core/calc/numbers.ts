/**
 * Locale-aware reading of numbers typed into the calculator. Both separators are accepted, and the
 * result is unambiguous wherever a human would read it the same way:
 * - "1.234,56" and "1,234.56" are both 1234.56 (the last separator is the decimal mark).
 * - A single separator is the decimal mark, unless it is the locale's grouping mark and exactly three
 *   digits follow a short leading group ("1.234" is 1234 in German, "1,234" is 1234 in English).
 * - "1.5" in German and "1,5" in English are 1.5 (the grouping rule does not fit).
 * - Several of the same separator must be groups of three ("1.234.567"); anything else is invalid.
 * Narrow spaces, no-break spaces and apostrophes between digits are grouping marks (fr, de-CH).
 */

export interface Separators {
  decimal: '.' | ',';
  group: '.' | ',';
}

/** Separators of an Intl locale (the grouping mark is only '.' or ',' for the rules above). */
export function separatorsFor(locale: string): Separators {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567.5);
  const decimal = parts.find((p) => p.type === 'decimal')?.value === '.' ? '.' : ',';
  return { decimal, group: decimal === '.' ? ',' : '.' };
}

const TOKEN = /[0-9]+(?:[.,'’\u00a0\u202f][0-9]+)*|[.,][0-9]+/g;
const GROUPS = (c: string) => new RegExp(`^[0-9]{1,3}(?:\\${c}[0-9]{3})+$`);

/** One number token → plain digits with '.' as decimal mark; undefined when it is ambiguous/invalid. */
export function normalizeNumberToken(token: string, sep: Separators): string | undefined {
  const t = token.replace(/['’\u00a0\u202f]/g, '');
  const marks = [...t].filter((c) => c === '.' || c === ',');
  if (marks.length === 0) return t;
  const last = marks[marks.length - 1]!;
  const kinds = new Set(marks);
  if (kinds.size === 2) {
    // The last mark is the decimal mark and must be unique; the other one groups by three.
    if (marks.filter((c) => c === last).length !== 1) return undefined;
    const other = last === '.' ? ',' : '.';
    const [int, frac] = t.split(last) as [string, string];
    if (!GROUPS(other).test(int)) return undefined;
    return `${int.replaceAll(other, '')}.${frac}`;
  }
  if (marks.length > 1) {
    return GROUPS(last).test(t) ? t.replaceAll(last, '') : undefined;
  }
  const [a, b] = t.split(last) as [string, string];
  if (last === sep.group && /^[1-9][0-9]{0,2}$/.test(a) && b.length === 3) return a + b;
  return `${a === '' ? '0' : a}.${b}`;
}

/** Replaces every number in `input` by its plain form; undefined when one of them is invalid. */
export function normalizeNumbers(input: string, sep: Separators): string | undefined {
  let bad = false;
  const out = input.replace(TOKEN, (token) => {
    const n = normalizeNumberToken(token, sep);
    if (n === undefined) {
      bad = true;
      return token;
    }
    return n;
  });
  return bad ? undefined : out;
}
