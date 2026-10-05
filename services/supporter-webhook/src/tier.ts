import type { SupporterTier } from '../../../packages/supporter-codes/src/index.ts';

/** "Kuchen" from this amount on (display only, nothing is unlocked by it). Unknown currency → kaffee. */
const KUCHEN_FROM: Readonly<Record<string, number>> = {
  EUR: 10,
  USD: 10,
  GBP: 9,
  CHF: 10,
  CAD: 14,
  AUD: 15,
  SEK: 110,
  NOK: 110,
  DKK: 75,
  PLN: 45,
  CZK: 250,
  JPY: 1500,
};

/** Tier for an amount string, or null when the amount is not a positive number. */
export function tierOf(
  amount: string,
  currency: string,
): Exclude<SupporterTier, 'developer'> | null {
  const value = Number(amount.replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  const limit = KUCHEN_FROM[currency.toUpperCase()];
  return limit !== undefined && value >= limit ? 'kuchen' : 'kaffee';
}
