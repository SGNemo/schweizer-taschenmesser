import { decimalSeparator, numberFormat } from '@/core/i18n/format';

/**
 * Money is stored as integer minor units (cents). The app uses a single currency for now;
 * a per-user currency setting can replace CURRENCY later without touching stored data.
 */
export const CURRENCY = 'EUR';

/** 1234 → "12,34 €" / "€12.34" (format region of this device; the currency is always the euro). */
export const formatMoney = (minor: number): string =>
  numberFormat({ style: 'currency', currency: CURRENCY }).format(minor / 100);

/** Whole-euro amount for chart axes: 120000 → "1.200" / "1,200". */
export const formatMoneyAxis = (minor: number): string =>
  numberFormat({ maximumFractionDigits: 0 }).format(minor / 100);

/** 1234 → "12,34" / "12.34" (for editing in an input; no thousands separators). */
export const formatMoneyInput = (minor: number): string =>
  numberFormat({ minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(
    minor / 100,
  );

/**
 * Parses user input such as "12,50", "1.234,56", "12.5", "1,234.56", "12 €" into minor units.
 * The format region's decimal mark is always decimal; the other mark groups thousands, except when it
 * appears once with at most two digits after it, so "12.50" also works in German and "12,50" in English.
 * Returns undefined for anything that is not a clean amount with at most two decimals.
 */
export function parseMoney(
  input: string,
  opts: { allowNegative?: boolean; decimal?: string } = {},
): number | undefined {
  let s = input.replace(/[\s€\u00a0\u202f']/g, '');
  if (!s) return undefined;
  let negative = false;
  if (s.startsWith('-')) {
    if (!opts.allowNegative) return undefined;
    negative = true;
    s = s.slice(1);
  }
  const decimal = opts.decimal ?? decimalSeparator();
  const group = decimal === ',' ? '.' : ',';
  if (s.includes(',') && s.includes('.')) {
    // Both marks: the region's decimal mark must come last ("1.234,56" in German, "1,234.56" in English).
    if (s.lastIndexOf(decimal) < s.lastIndexOf(group)) return undefined;
    if (s.split(decimal).length > 2) return undefined;
    s = s.split(group).join('').replace(decimal, '.');
  } else if (s.includes(decimal)) {
    // Only the region's decimal mark: one of them, at most two digits after it ("12,50").
    const parts = s.split(decimal);
    if (parts.length !== 2 || parts[1]!.length > 2) return undefined;
    s = parts.join('.');
  } else if (s.includes(group)) {
    // Only the other mark: "12.5" / "12.50" is a decimal, "1.234" / "1.234.567" groups thousands.
    const parts = s.split(group);
    const isDecimal = parts.length === 2 && parts[1]!.length <= 2;
    s = isDecimal ? parts.join('.') : parts.join('');
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
