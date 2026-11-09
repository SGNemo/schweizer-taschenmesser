# review/ui-audit-2026-11 – UI audit with council (docs only)

- **State (2026-11-09):** Sven leans to 4.0 ("eher 4"); seven council rounds done (LEDGER.md), the folder was split into REPORT.md (decision), LEDGER.md, PACKAGE-0.md (0a spec), PACKAGES.md (0b-1…0b-8), mockups/ (4.0 target form, images on `shots/ui-audit-2026-11` under mockups/); rounds 8–9 run on the whole folder; **no PR** (Sven's order).
- **Next chat:** after Sven's answers to questions 2–4 adjust PACKAGES.md "Nach Svens Antworten", then the PR with label `no-changelog`; remove the CHATS.md row in the last commit. Mockups re-render from `web/` with `node ../docs/design/ui-audit-2026-11/mockups/render.mjs`.
- **Tools:** `tools/*.spec.ts` + `playwright.audit.config.ts` run by copying into `web/` and `web/e2e/screenshots/` (seeded preview :4174); never commit those copies. Screenshots live on the orphan branch `shots/ui-audit-2026-11`.
- **Heads-up:** `fix/ui6-head-heights` (U41) becomes moot under 4.0 (BOARD.md); loading-robustness hand test (Maßnahme 0) is Sven's, nothing fixed.
