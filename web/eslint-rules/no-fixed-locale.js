// @ts-check
/**
 * A fixed `'de-DE'` is a bug in a five-language app: dates and numbers go through `core/i18n/format`, which
 * follows the chosen language (CLAUDE.md, UI rules; docs/howto/i18n.md). The literal is right in three places
 * only, where the language is mapped to its locale tag: `core/i18n`, `core/time`, `core/voice`.
 *
 * Exported as plain config data (selectors for the core rule `no-restricted-syntax`), not as a plugin:
 * `eslint.config.js` puts it into its own block. ESLint replaces the options of a rule per file instead of
 * merging them, so that block must repeat the selectors of the block it overrides (see the config).
 */
const MESSAGE =
  "No fixed 'de-DE': format dates and numbers with @/core/i18n/format (it follows the chosen language).";

/** Where the rule applies … */
export const FIXED_LOCALE_FILES = ['src/**/*.{ts,tsx}'];
/** … and where it does not: tests, and the three places that map a language to its locale tag. */
export const FIXED_LOCALE_IGNORES = [
  'src/**/*.test.*',
  'src/core/i18n/**',
  'src/core/time/**',
  'src/core/voice/**',
];

/** Selectors for `no-restricted-syntax`: a string literal and a template without placeholders. */
export const fixedLocaleSelectors = [
  { selector: "Literal[value='de-DE']", message: MESSAGE },
  {
    selector: "TemplateLiteral[quasis.length=1] > TemplateElement[value.cooked='de-DE']",
    message: MESSAGE,
  },
];
