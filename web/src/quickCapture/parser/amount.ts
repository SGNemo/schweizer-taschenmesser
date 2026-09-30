import { take, word, type Scan } from './util';

const NUM = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const CUR = String.raw`€|eur(?:o)?(?![\p{L}\d])`;

const AFTER = new RegExp(String.raw`(?<![\d.,])([+-])?\s?(${NUM})\s?(?:${CUR})`, 'iu');
const BEFORE = new RegExp(String.raw`(?:${CUR})\s?(${NUM})(?![\d])`, 'iu');
const BARE = new RegExp(String.raw`(?<![\d.,:])([+-])?(${NUM})(?![\d.,:])`, 'u');
const INCOME = word(
  'einnahmen?|gehalt|lohn|erhalten|bekommen|rückerstattung|erstattung|eingang|gutschrift',
);

/** "12,50" / "1.234,56" / "12.5" → integer cents, or undefined when not a clean positive amount. */
export function toCents(num: string): number | undefined {
  let s = num;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const [int = '0', frac = ''] = s.split('.');
  const cents = Number(int) * 100 + Number(frac.padEnd(2, '0').slice(0, 2));
  return Number.isSafeInteger(cents) && cents > 0 && cents < 1e11 ? cents : undefined;
}

export interface AmountMatch {
  amountMinor: number;
  kind: 'expense' | 'income';
}

/**
 * Finds an amount. A currency marker (€, EUR, Euro) is required; with `allowBare` (finance prefix)
 * the first stand-alone number counts too. Call it after dates and times were removed from `s`.
 */
export function extractAmount(s: Scan, allowBare: boolean): AmountMatch | undefined {
  const original = s.t;
  let m = take(s, AFTER);
  let sign = m?.[1];
  let num = m?.[2];
  if (!m) {
    m = take(s, BEFORE);
    num = m?.[1];
  }
  if (!m && allowBare) {
    m = take(s, BARE);
    sign = m?.[1];
    num = m?.[2];
  }
  const amountMinor = num ? toCents(num) : undefined;
  if (!m || amountMinor === undefined) {
    s.t = original;
    return undefined;
  }
  const income = sign === '+' || INCOME.test(original);
  return { amountMinor, kind: income ? 'income' : 'expense' };
}
