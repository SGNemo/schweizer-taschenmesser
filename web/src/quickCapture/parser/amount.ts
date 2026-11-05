import { take, word, type Scan } from './util';

const NUM = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const CUR = String.raw`€|eur(?:o)?(?![\p{L}\d])`;

const AFTER = new RegExp(
  String.raw`(?<![\d.,])((?<![\p{L}\d])[+-])?\s?(${NUM})\s?(?:${CUR})`,
  'iu',
);
const BEFORE = new RegExp(String.raw`(?<![\p{L}\d])(?:${CUR})\s?(${NUM})(?![\d])`, 'iu');
/** Other currencies by symbol, ISO code or word ("12 USD", "¥500", "20 Dollar"); never converted. */
const FOREIGN: Record<string, string> = {
  $: 'USD',
  '£': 'GBP',
  '¥': 'JPY',
  dollar: 'USD',
  dollars: 'USD',
  franken: 'CHF',
  yen: 'JPY',
};
const FOREIGN_CODES = ['USD', 'GBP', 'CHF', 'JPY', 'MXN', 'BRL', 'CAD', 'AUD', 'CNY'];
const FOREIGN_SRC = String.raw`[$£¥]|(?:${FOREIGN_CODES.join('|')}|dollars?|franken|yen)(?![\p{L}\d])`;
const FOREIGN_AFTER = new RegExp(
  String.raw`(?<![\d.,])((?<![\p{L}\d])[+-])?\s?(${NUM})\s?(${FOREIGN_SRC})`,
  'iu',
);
const FOREIGN_BEFORE = new RegExp(
  String.raw`(?<![\p{L}\d])(${FOREIGN_SRC})\s?(${NUM})(?![\d])`,
  'iu',
);
const currencyOf = (marker: string): string =>
  FOREIGN[marker.toLowerCase()] ?? marker.toUpperCase();
const BARE = new RegExp(String.raw`(?<![\d.,:])((?<![\p{L}\d])[+-])?(${NUM})(?![\d.,:])`, 'u');
/** A number with decimal comma and no currency word: "12,99" next to "monatlich". */
const BARE_DECIMAL = /(?<![\d.,:])(\d{1,3}(?:\.\d{3})*,\d{1,2}|\d+,\d{1,2})(?![\d.,:])/u;
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
  /** ISO 4217 code of an amount in another currency; absent for the euro. */
  currency?: string;
}

/**
 * Finds an amount. A currency marker (€, EUR, Euro, or another currency such as "12 USD", "¥500")
 * is required; with `allowBare` (finance prefix)
 * the first stand-alone number counts too; `'decimal'` only accepts one with a decimal comma. Call it after dates and times were removed from `s`.
 */
export function extractAmount(s: Scan, allowBare: boolean | 'decimal'): AmountMatch | undefined {
  const original = s.t;
  let m = take(s, AFTER);
  let sign = m?.[1];
  let num = m?.[2];
  if (!m) {
    m = take(s, BEFORE);
    num = m?.[1];
  }
  let currency: string | undefined;
  if (!m) {
    m = take(s, FOREIGN_AFTER);
    sign = m?.[1];
    num = m?.[2];
    if (m) currency = currencyOf(m[3]!);
  }
  if (!m) {
    m = take(s, FOREIGN_BEFORE);
    num = m?.[2];
    if (m) currency = currencyOf(m[1]!);
  }
  if (!m && allowBare === 'decimal') {
    m = take(s, BARE_DECIMAL);
    num = m?.[1];
  } else if (!m && allowBare) {
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
  return { amountMinor, kind: income ? 'income' : 'expense', ...(currency ? { currency } : {}) };
}
