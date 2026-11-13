import { Fragment, type ReactNode } from 'react';
import { t } from '@/strings';
import { useHideValues } from './hideValues';

const SPACE = '[\\s\\u00a0\\u202f]';
const DIGITS = "\\d[\\d.,'’]*";
/** More digit groups after a space ("1 017,84 €"), only before a currency: a count after an amount is not taken. */
const GROUPS = `(?:${SPACE}\\d{3}[\\d.,'’]*)*`;
const CODE = '(?:EUR|CHF|USD|Euro|Franken)';

/**
 * A money amount inside running text ("Stadtwerke · 87,40 €", "noch 1 017,84 €", "CHF 12.50", "54,30EUR"). Shared by
 * the tray, which never carries money, and by the overview, which hides it with "Werte ausblenden". A digit run is
 * only started where no digit stands before it, so a long number is read once.
 */
export const AMOUNT_IN_TEXT = new RegExp(
  `(?:[€$£]|\\b(?:EUR|CHF|USD|Euro)(?![A-Za-z]))${SPACE}?[-+]?${DIGITS}` +
    `|(?<![\\d.,'’])[-+]?${DIGITS}${GROUPS}${SPACE}?(?:[€$£]|${CODE}(?![A-Za-z]))`,
  'gi',
);

/** The neutral placeholder of a hidden amount (the dots of `ui/SensitiveValue`). */
export const HIDDEN_AMOUNT = '••••';

/** `text` with every amount replaced by the placeholder (for plain text: the tray, a test). */
export const maskAmounts = (text: string): string => text.replace(AMOUNT_IN_TEXT, HIDDEN_AMOUNT);

/** The same as nodes: the dots are decoration, a screen reader hears "Ausgeblendet" (as with `ui/SensitiveValue`). */
function maskedNodes(text: string): ReactNode {
  const parts = text.split(AMOUNT_IN_TEXT);
  if (parts.length === 1) return text;
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 ? (
        <>
          <span aria-hidden="true">{HIDDEN_AMOUNT}</span>
          <span className="sr-only">{t.widgets.valueHidden}</span>
        </>
      ) : null}
    </Fragment>
  ));
}

/**
 * For lines that carry an amount inside other text (a title, a context line) and so cannot use `SensitiveValue`:
 * returns a function that hides the amounts while "Werte ausblenden" is on (and while the setting loads).
 */
export function useAmountMask(): (text: string) => ReactNode {
  const hide = useHideValues();
  return hide ? maskedNodes : (text) => text;
}
