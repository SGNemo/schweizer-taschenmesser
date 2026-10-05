/** Display-name hygiene for supporter codes: short, plain text, no control or bidi tricks. */

export const MAX_NAME_CODE_POINTS = 20;

// Cc = control, Cf = format (zero-width, bidi marks/overrides, BOM), Zl/Zp = line/paragraph sep.
const FORBIDDEN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

/**
 * Normalises a free-text name: NFC, forbidden characters replaced by a space, whitespace
 * collapsed, at most 20 code points. Returns '' when nothing usable is left (= no name).
 * Idempotent.
 */
export function sanitizeName(raw: string): string {
  const cleaned = raw.normalize('NFC').replace(FORBIDDEN, ' ').replace(/\s+/gu, ' ').trim();
  return [...cleaned].slice(0, MAX_NAME_CODE_POINTS).join('').trim();
}
