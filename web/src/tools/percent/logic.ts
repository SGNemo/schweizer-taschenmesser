/** Percent and VAT calculations (pure). */

/** p % of whole. */
export const percentOf = (p: number, whole: number): number => (whole * p) / 100;

/** How many percent `part` is of `whole` (undefined for a whole of 0). */
export const shareOf = (part: number, whole: number): number | undefined =>
  whole === 0 ? undefined : (part / whole) * 100;

export interface Vat {
  net: number;
  tax: number;
  gross: number;
}

/** VAT split of an amount that is net (`fromNet`) or gross; rounded to cents. */
export function vat(amount: number, ratePercent: number, fromNet: boolean): Vat {
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const net = fromNet ? amount : amount / (1 + ratePercent / 100);
  const gross = fromNet ? amount * (1 + ratePercent / 100) : amount;
  const tax = gross - net;
  return { net: round(net), tax: round(tax), gross: round(gross) };
}
