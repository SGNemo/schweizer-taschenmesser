# Frozen languages – Español, Français, Português (Brasil)

Since 2026-11-06 the app and the website offer **German and English only** (`ACTIVE_LOCALES = ['de', 'en']` in `web/src/core/i18n/lang.ts`; site: `LOCALES` in `site/src/i18n/index.ts`). Spanish, French and Brazilian Portuguese are **frozen**: nothing was deleted, but nothing is shown, shipped or kept up to date. Decision: [decisions/language.md](../decisions/language.md).

## What frozen means

- **Kept in the repo:** catalogs `web/src/i18n/locales/{es,fr,pt-BR}/`, frozen entries in `defineBundle` texts, seed data, date patterns, native texts (`web/src-tauri/src/texts.rs`), website texts `site/src/i18n/{es,fr,pt}.ts`, glossary columns, `same-as-source.json` lists.
- **Not shipped:** no catalog loader (the three chunks are not in the build), excluded from `tsconfig.app.json`, not offered by the picker, setup, system detection or seed data. The website builds no `/es`, `/fr`, `/pt-br` pages; the old URLs redirect to `/en` (`site/public/_redirects` 301 + static meta-refresh pages from `astro.config.mjs`, no script).
- **Not maintained:** `check:i18n` and the tests require German and English only; frozen entries in `defineBundle` texts and seeds are optional and untyped, so a new German key never forces one. New texts never go into a frozen catalog.
- **A device that had a frozen language** stored (`tm-lang`) quietly switches to English on the next start (`readLangPref`, no dialog); if its formats followed the language (`tm-format` unset or `auto`), they are pinned to that language's region (es-ES, fr-FR, pt-BR), so decimal mark and date order stay. "Like the device" on a Spanish, French or Portuguese device resolves to English.

## State at freeze (2026-11-06)

`checkCatalog` against the German source (6007 texts):

| Language | Texts translated | Missing / problems |
| -------- | ---------------- | ------------------ |
| es       | 6007 / 6007      | 0                  |
| fr       | 6007 / 6007      | 0                  |
| pt-BR    | 6007 / 6007      | 0                  |

Every text added after this date is missing in all three (they fall back to English if one is re-activated).

## Re-activate a language (three steps)

1. **List it:** move the code from `FROZEN_LOCALES` to `ACTIVE_LOCALES` and add its name to `LANG_NAMES` (`web/src/core/i18n/lang.ts`; `gen:modules` follows it). Hand-kept copies: the loader in `core/i18n/catalogs.ts`, `exclude` in `web/tsconfig.app.json`, `src/i18n/catalogs.test.ts`, `scripts/gen-module.mjs`, `scripts/check-tools.mjs`, `FALLBACK_BODY` in `core/notifications/pushPayload.ts`, the lists in `e2e/i18n-layout.spec.ts` and `e2e/screenshots/languages.spec.ts`, `from_primary`/`from_windows_langid` in `src-tauri/src/texts.rs`; drop the language from `migrateFrozen` in `lang.ts`.
2. **Catch up:** `npm run i18n:scaffold -- <lang>` adds the missing part files; `npm run typecheck` and `npm run check:i18n` list every missing or stale text – translate them with the [glossary](GLOSSARY.md), also in `defineBundle` texts that left the language out.
3. **Website and docs:** add it to `LOCALES`/`routes`/`strings` in `site/src/i18n/index.ts`, `INTL` in `site/src/lib/release.ts` and `astro.config.mjs` (`i18n`, sitemap), restore `site/src/pages/<lang>/index.astro`, remove its lines from `site/public/_redirects` and `redirects`; update CLAUDE.md, [howto/i18n.md](../howto/i18n.md), this file, and run MANUAL-TESTS "Sprachen".
