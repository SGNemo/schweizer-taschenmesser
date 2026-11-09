/**
 * Clock captures: `uhr Tokio`, `Uhr: New York`, `clock Lisbon` → a place for the Uhr module. Pure: whether the rest
 * is a place is asked from the caller (`ParseOptions.place`, the offline city search), so „Uhr reparieren lassen“
 * stays a ToDo. Runs only when the caller can save places (the module is on).
 */
import type { CaptureResult, ParseOptions } from './types';

/** Word prefixes (the one letters are taken): German and English. */
export const PLACE_PREFIX = /^\s*(?:uhr|weltuhr|clock)\s*:?\s+/i;

export function parsePlace(input: string, opts: ParseOptions): CaptureResult | undefined {
  if (!opts.place) return undefined;
  const m = PLACE_PREFIX.exec(input);
  if (!m) return undefined;
  const name = input.slice(m[0].length).trim();
  // A time or a count is no place name („Uhr 9 Uhr stellen“).
  if (!name || /\d/.test(name) || !opts.place(name)) return undefined;
  return {
    type: 'place',
    fields: { title: name },
    confidence: 0.95,
    needsChoice: false,
    forced: true,
    alternatives: [{ type: 'todo', confidence: 0.3 }],
    notes: [],
  };
}
