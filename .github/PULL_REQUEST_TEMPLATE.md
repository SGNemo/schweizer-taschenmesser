## What and why

## Checklist
- [ ] Base branch is `develop`
- [ ] `npm run lint`, `npm run typecheck`, `npm test` pass in `web/` (and in `server/` / `mcp/` if touched)
- [ ] UI texts in `web/src/strings.ts`, tokens and shared components only (no hex colours in module CSS)
- [ ] No internal identifier changed (`brand-ids.test.ts` green), no secrets, release security steps untouched
- [ ] Docs updated where a decision or recipe changed (`docs/DECISIONS.md`, `docs/HOW-TO.md`, `docs/STATUS.md`)
