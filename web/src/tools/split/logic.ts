export interface SplitResult {
  tip: number;
  sum: number;
  perPerson: number;
}

/** Splits a bill (currency amount) over `people`, adds `tipPercent` and optionally rounds each share up. */
export function splitBill(
  total: number,
  people: number,
  tipPercent: number,
  roundUp: boolean,
): SplitResult | undefined {
  if (!Number.isFinite(total) || total < 0) return undefined;
  if (!Number.isInteger(people) || people < 1 || people > 1000) return undefined;
  if (!Number.isFinite(tipPercent) || tipPercent < 0) return undefined;
  const tip = Math.round(total * tipPercent) / 100;
  const share = (total + tip) / people;
  // round to cents first: 33.000000001 must not become 34 when rounded up
  const cents = Math.round(share * 100) / 100;
  const perPerson = roundUp ? Math.ceil(cents) : cents;
  return { tip, sum: roundUp ? perPerson * people : total + tip, perPerson };
}
