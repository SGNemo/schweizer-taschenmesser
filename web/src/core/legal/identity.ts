/**
 * Who is behind Nemo, for the "Rechtliches" settings sections. Every value that must come from the maintainer is a
 * `[[PLACEHOLDER]]`: nothing is invented. Fill them in here (one place) and check with `npm run check:legal`;
 * `docs/legal/LAUNCH-LEGAL-CHECKLIST.md` lists them. Not legal advice.
 */
export const LEGAL_IDENTITY = {
  /** Full name of the provider (Anbieter). */
  name: '[[NAME]]',
  /** Street and number. */
  street: '[[ADRESSE]]',
  /** Postcode and city. */
  city: '[[PLZ_ORT]]',
  country: '[[LAND]]',
  /** Address for quick contact (also shown for privacy requests). */
  email: '[[KONTAKT_EMAIL]]',
  /** Only if applicable (trade, VAT id); leave `''` when none. */
  vatId: '',
} as const;

/** Open placeholders look like `[[NAME]]` (capital letters, digits, underscore). */
export const PLACEHOLDER_PATTERN = /\[\[[A-Z0-9_]+\]\]/g;

/** The distinct placeholders in a text, in order of appearance. */
export function findPlaceholders(text: string): string[] {
  return [...new Set(text.match(PLACEHOLDER_PATTERN) ?? [])];
}
