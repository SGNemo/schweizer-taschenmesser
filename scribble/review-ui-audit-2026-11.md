# review/ui-audit-2026-11 – UI audit with council (docs only)

- **State (2026-11-09):** phase 3 done, five council rounds on the report (scores per round in REPORT.md "Council über den Ist-Zustand"), branch pushed, **no PR** (Sven's order). Waiting for Sven's answers to the four questions in REPORT.md "Fragen an Sven".
- **Next chat:** after the answers write `PACKAGES.md` (package 0a-1/0a-2/0a-3 + 0b per REPORT "Empfehlung"), mockups, then the PR with label `no-changelog`; remove the CHATS.md row in the last commit.
- **Tools:** `tools/*.spec.ts` + `playwright.audit.config.ts` run by copying into `web/` and `web/e2e/screenshots/` (seeded preview :4174); never commit those copies. Screenshots live on the orphan branch `shots/ui-audit-2026-11`.
- **Heads-up:** `fix/ui6-head-heights` (U41) becomes moot under 4.0 (BOARD.md); loading-robustness hand test (Maßnahme 0) is Sven's, nothing fixed.
