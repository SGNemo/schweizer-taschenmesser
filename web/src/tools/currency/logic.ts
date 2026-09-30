/** Currency conversion on ECB reference rates (pure). Rates are "units of currency per 1 EUR". */
import { z } from 'zod';

export interface Rates {
  /** 'YYYY-MM-DD' of the reference rates. */
  date: string;
  rates: Record<string, number>;
}

const responseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rates: z.record(z.string(), z.number().positive()),
});

/** Frankfurter answer (base EUR) → `Rates` including EUR itself; undefined for anything odd. */
export function parseRates(json: unknown): Rates | undefined {
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success || Object.keys(parsed.data.rates).length === 0) return undefined;
  return { date: parsed.data.date, rates: { EUR: 1, ...parsed.data.rates } };
}

export function convert(amount: number, from: string, to: string, r: Rates): number | undefined {
  const a = r.rates[from];
  const b = r.rates[to];
  if (a === undefined || b === undefined) return undefined;
  return (amount / a) * b;
}

export const currencies = (r: Rates): string[] => Object.keys(r.rates).sort();
