## What and why

## Checklist
- [ ] Base branch is `develop`
- [ ] `npm run lint`, `npm run typecheck`, `npm test` pass in `web/` (and in `server/` / `mcp/` if touched)
- [ ] UI texts in `web/src/strings.ts` and the English catalog `web/src/i18n/locales/en/` (`npm run check:i18n`; es/fr/pt-BR frozen, `docs/i18n/FROZEN.md`), tokens and shared components only (no hex colours in module CSS)
- [ ] No internal identifier changed (`brand-ids.test.ts` green), no secrets, release security steps untouched
- [ ] New module? → home-screen widget present, empty state with an action, `npm run check:modules` and `src/core/modules/widgets.test.tsx` green, screenshot of the home screen attached (made-up data only)
- [ ] New module? → `seed.ts` + `seed` in the manifest present, `core/seed/registry.test.ts` green, Dev-Preview checked with test data (Settings → Entwickler)
- [ ] Change note in `.changes/` (`npm run change`; German + English, user view) or label `no-changelog` (docs/tests/CI only)
- [ ] Docs updated where a decision or recipe changed (`docs/DECISIONS.md`, `docs/HOW-TO.md`, `docs/STATUS.md`; one line each)
- [ ] Docs changed? `npm run check:docs` (in `web/`) has no new warnings
- [ ] Module name, description, area or platform changed? `npm run gen:modules` (in `web/`) updates the module tables in the READMEs, `docs/user/modules*.md` and the website list
- [ ] README or user docs changed? German copy (`README.de.md`, `*.de.md`) updated too, `npm run check:readme` and `npm run check:doclinks` (in `web/`) green
