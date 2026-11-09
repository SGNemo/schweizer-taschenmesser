# review/ui-audit-2026-11 – UI audit with council (docs only)

- **State (2026-11-09):** Sven leans to 4.0 ("eher 4"); seven council rounds done (LEDGER.md), the folder was split into REPORT.md (decision), LEDGER.md, PACKAGE-0.md (0a spec), PACKAGES.md (0b-1…0b-8), mockups/ (4.0 target form, images on `shots/ui-audit-2026-11` under mockups/); rounds 8–9 ran on the whole folder (final 8/8/7, LEDGER.md); **no PR** (Sven's order); the last reworks (ratchet semantics, device-local keep state, package 0a-4) were applied after the final round.
- **Sven answered 2026-11-09: 1 A, 2 A, 3 A, 4 A** (4.0 now, V-1 + four module packages, areas stay / sub-nav gone / bottom bar with plus, 48-px rows); RULES.md:16 approval still open. Rounds 10–11 requested after 8/8/7.
- **Next chat:** the PR with label `no-changelog` once Sven says so (he explicitly said no PR for now); remove the CHATS.md row in the last commit. Mockups re-render from `web/` with `node ../docs/design/ui-audit-2026-11/mockups/render.mjs`.
- **Tools:** `tools/*.spec.ts` + `playwright.audit.config.ts` run by copying into `web/` and `web/e2e/screenshots/` (seeded preview :4174); never commit those copies. Screenshots live on the orphan branch `shots/ui-audit-2026-11`.
- **Heads-up:** `fix/ui6-head-heights` (U41) becomes moot under 4.0 (BOARD.md); loading-robustness hand test (Maßnahme 0) is Sven's, nothing fixed.
