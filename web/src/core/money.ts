/**
 * Money is stored as integer minor units (cents). The app uses a single currency for now;
 * a per-user currency setting can replace CURRENCY later without touching stored data.
 */
export const CURRENCY = 'EUR';

const formatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: CURRENCY });
const plain = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compact = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

/** 1234 → "12,34 €". */
export const formatMoney = (minor: number): string => formatter.format(minor / 100);

/** Whole-euro amount for chart axes: 120000 → "1.200". */
export const formatMoneyAxis = (minor: number): string => compact.format(minor / 100);

/** 1234 → "12,34" (for editing in an input). */
export const formatMoneyInput = (minor: number): string =>
  plain.format(minor / 100).replace(/\./g, '');

/**
 * Parses user input such as "12,50", "1.234,56", "12.5", "12 €" into minor units.
 * Returns undefined for anything that is not a clean amount with at most two decimals.
 */
export function parseMoney(
  input: string,
  opts: { allowNegative?: boolean } = {},
): number | undefined {
  let s = input.replace(/[\s€]/g, '');
  if (!s) return undefined;
  let negative = false;
  if (s.startsWith('-')) {
    if (!opts.allowNegative) return undefined;
    negative = true;
    s = s.slice(1);
  }
  if (s.includes(',')) {
    // German style: dots are thousands separators, the comma is the decimal mark.
    if (s.split(',').length > 2) return undefined;
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes('.')) {
    const parts = s.split('.');
    // "12.5" / "12.50" is a decimal; "1.234" / "1.234.567" are thousands separators.
    const decimal = parts.length === 2 && parts[1]!.length <= 2;
    if (!decimal) s = parts.join('');
  }
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return undefined;
  const minor = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(minor)) return undefined;
  return negative ? -minor : minor;
}

export const sumMinor = (values: Iterable<number>): number => {
  let total = 0;
  for (const v of values) total += v;
  return total;
};
