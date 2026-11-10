// @ts-check
/**
 * No `autoFocus` in JSX (UI audit 2026-11, follow-up to package 0a; CLAUDE.md, UI rules). React's
 * `autoFocus` runs before a dialog is open and moves the focus without the shell knowing; the field that
 * should get the focus is marked with `data-autofocus` instead, and `Dialog` / the page focus it once it is
 * shown (docs/howto/design-rules.md).
 *
 * Exported as plain config data (a selector for the core rule `no-restricted-syntax`) like
 * `no-fixed-locale.js`: ESLint replaces the options of a rule per file instead of merging them, so every
 * block of `eslint.config.js` that sets `no-restricted-syntax` for `src/` repeats it.
 */
const MESSAGE =
  'No autoFocus: mark the field with data-autofocus; Dialog and the page focus it once it is shown (docs/howto/design-rules.md).';

/** Selectors for `no-restricted-syntax`: the JSX attribute, with or without a value. */
export const autoFocusSelectors = [
  { selector: "JSXAttribute[name.name='autoFocus']", message: MESSAGE },
];
