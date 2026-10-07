/**
 * The calculator of the command palette: recognises arithmetic ("12*3,5", "240 + 19%") and the few
 * German phrases people type ("19% von 240", "30 von 200 in prozent"). Strictly local, no network.
 */
import { t } from '@/strings';
import { CalcError, evaluate, formatNumber } from './expr';

export interface CalcAnswer {
  /** The number, for copying. */
  value: number;
  /** "240 + 19% = 285,6" */
  text: string;
}

const NUM = String.raw`(-?[0-9][0-9.,]*)`;
const OF = new RegExp(`^${NUM}\\s*(?:%|prozent)\\s+von\\s+${NUM}$`, 'i');
const SHARE = new RegExp(`^${NUM}\\s+von\\s+${NUM}\\s+in\\s+(?:%|prozent)$`, 'i');
const ARITHMETIC = /^[0-9\s.,+\-−–*×·÷:/^()%]+$|sqrt|wurzel|π|\bpi\b/i;

function num(text: string): number {
  return evaluate(text);
}

/** Does this look like something to calculate (and not a search term)? */
export function looksLikeCalculation(input: string): boolean {
  const s = input.trim();
  if (!/[0-9]/.test(s)) return false;
  if (OF.test(s) || SHARE.test(s)) return true;
  if (!ARITHMETIC.test(s)) return false;
  // A bare number or a date like "29.09.2026" is a search, not a sum.
  return (
    /[+\-−–*×·÷:/^%()]|sqrt|wurzel/i.test(s.replace(/^-/, '')) &&
    !/^\d{1,2}\.\d{1,2}\.(\d{2}|\d{4})$/.test(s)
  );
}

export function calculate(input: string): CalcAnswer | undefined {
  const s = input.trim();
  if (!looksLikeCalculation(s)) return undefined;
  try {
    const of = OF.exec(s);
    if (of) {
      const value = evaluate(`${of[2]}*${of[1]}%`);
      return {
        value,
        text: t.tools.calc.percentOf(
          formatNumber(num(of[1]!)),
          formatNumber(num(of[2]!)),
          formatNumber(value),
        ),
      };
    }
    const share = SHARE.exec(s);
    if (share) {
      const part = num(share[1]!);
      const whole = num(share[2]!);
      if (whole === 0) return undefined;
      const value = evaluate(`${share[1]}/${share[2]}*100`);
      return {
        value,
        text: t.tools.calc.shareOf(formatNumber(part), formatNumber(whole), formatNumber(value)),
      };
    }
    const value = evaluate(s);
    return { value, text: `${s} = ${formatNumber(value)}` };
  } catch (e) {
    if (e instanceof CalcError) return undefined;
    throw e;
  }
}
