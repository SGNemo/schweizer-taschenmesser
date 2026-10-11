/**
 * Who is behind Nemo, for the "Rechtliches" settings sections. The postal address is deliberately NOT in this
 * repository: the full imprint (name, address) lives on the website, where the build reads it from environment
 * variables (`site/src/legal.js`). The app only knows the contact e-mail and where the imprint is.
 * Not legal advice; see `docs/legal/LAUNCH-LEGAL-CHECKLIST.md`.
 */
export const SITE_URL = 'https://nemo-adhd-helper.online';

export const LEGAL_IDENTITY = {
  /** Address for quick contact (also shown for privacy requests); the same one the website shows. */
  email: 'sven.nemo0@gmail.com',
  /** The full imprint with the provider's name and address. */
  imprintUrl: `${SITE_URL}/impressum`,
} as const;

/** Open placeholders look like `[[NAME]]` (capital letters, digits, underscore). */
export const PLACEHOLDER_PATTERN = /\[\[[A-Z0-9_]+\]\]/g;

/** The distinct placeholders in a text, in order of appearance. */
export function findPlaceholders(text: string): string[] {
  return [...new Set(text.match(PLACEHOLDER_PATTERN) ?? [])];
}
