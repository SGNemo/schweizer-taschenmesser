import { useHideValues } from './hideValues';

/**
 * A money amount inside running text ("Stadtwerke · 87,40 €", "noch 1,02 €", "CHF 12.50"). Shared by the tray, which
 * never carries money, and by the overview, which hides it with "Werte ausblenden".
 */
export const AMOUNT_IN_TEXT =
  /(?:[€$£]|\b(?:EUR|CHF|USD|Euro)\b)\s?[-+]?\d[\d.,'’ ]*|[-+]?\d[\d.,'’]*\s?(?:[€$£]|\b(?:EUR|CHF|USD|Euro|Franken)\b)/gi;

/** The neutral placeholder of a hidden amount (the dots of `ui/SensitiveValue`). */
export const HIDDEN_AMOUNT = '••••';

/** `text` with every amount replaced by the placeholder. */
export const maskAmounts = (text: string): string =>
  text.replace(AMOUNT_IN_TEXT, (m) => (/\s$/.test(m) ? `${HIDDEN_AMOUNT} ` : HIDDEN_AMOUNT));

/**
 * For lines that carry an amount inside other text (a title, a context line) and so cannot use `SensitiveValue`:
 * returns a function that masks the amounts while "Werte ausblenden" is on (and while the setting loads).
 */
export function useAmountMask(): (text: string) => string {
  const hide = useHideValues();
  return hide ? maskAmounts : (text) => text;
}
