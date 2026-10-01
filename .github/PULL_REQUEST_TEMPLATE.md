## What and why

## Checklist
- [ ] Base branch is `develop`
- [ ] `npm run lint`, `npm run typecheck`, `npm test` pass in `web/` (and in `server/` / `mcp/` if touched)
- [ ] UI texts in `web/src/strings.ts`, tokens and shared components only (no hex colours in module CSS)
- [ ] No internal identifier changed (`brand-ids.test.ts` green), no secrets, release security steps untouched
- [ ] New module? → home-screen widget present, empty state with an action, `npm run check:modules` and `src/core/modules/widgets.test.tsx` green, screenshot of the home screen attached (made-up data only)
- [ ] New module? → `seed.ts` + `seed` in the manifest present, `core/seed/registry.test.ts` green, Dev-Preview checked with test data (Settings → Entwickler)
- [ ] Docs updated where a decision or recipe changed (`docs/DECISIONS.md`, `docs/HOW-TO.md`, `docs/STATUS.md`)
