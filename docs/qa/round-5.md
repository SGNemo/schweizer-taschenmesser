# First-contact round 5 – summary

Stand 2026-11-10. Four personas, one run each on `develop` with `npm run dev:all`:

- **A** – first start and setup assistant (Android UA, 412 px, outer display 320 × 332)
- **B** – office clerk with Sparkasse CSV, budgets, export (Windows + Samsung UA)
- **C** – mechanic, quick capture on a phone (412 px, touch targets, Tester-Modus)
- **D** – systems integrator: LAN sync, backup, Obsidian import, network log

Persona and follow-up prompts stay next to this file in `docs/qa/round-5/<x>/` (`PERSONA.md`, `FOLLOWUP.md`). The per-person `FINDINGS.md` tables were folded into this summary; their full text is in git history (`git show 794cd68:docs/qa/round-5/<x>/FINDINGS.md`). `MESSAGE.md` stays until the maintainer has sent it.

Tests: [`web/e2e/first-contact-b.spec.ts`](../../web/e2e/first-contact-b.spec.ts) (person B, fixture `web/e2e/fixtures/sparkasse-demo.csv`) and the round-5 unit tests named in the old tables.

## Fixed

Every finding the old tables marked as fixed (A01–A09, A14, A15, B01–B07, B09, B12, C01–C05, C06, C08, C09, D03–D12) went through its own PR on `feat/demo-a` … `feat/demo-d` or a `fix/*` branch and is in `develop`. Also fixed outside the per-person branches: A10 and A13 (`feat/devpreview-first-start`; the toast part via C06), B05 and B08 (`core/setup/migrate.ts`).

## Open – no PR yet

| Id   | Finding                                                                                                                                                                                   | Next step                                                  | Owner               |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------- |
| A11  | Step count changes without action (`2 von 10` → `2 von 9`)                                                                                                                                | Follow-up F2 in [a/FOLLOWUP.md](round-5/a/FOLLOWUP.md), S  | setup (demo-a area) |
| A12  | Outer display (320 × 332): app shows only header and bar                                                                                                                                  | Follow-up F1: Android "Heute" widget, three packages       | not started         |
| B10  | "2 Zeilen übersprungen" does not name the rows                                                                                                                                            | Sketch in [b/FOLLOWUP.md](round-5/b/FOLLOWUP.md), S        | not started         |
| B-fu | Balance date for later imports (decision: data model); reconciled marker; Sparkonto counted in "Diesen Monat"; two Konto-Dialog items (error placement, locked field shows the old value) | [b/FOLLOWUP.md](round-5/b/FOLLOWUP.md)                     | Sven (decision)     |
| D11  | Section "Was ging wohin?" set to stable; open question on its wording                                                                                                                     | Question to Sven (commit `92a2ae37`)                       | Sven                |
| C11  | Overview stays empty after the dev auto-fill until reload                                                                                                                                 | Board: home/seed, unclaimed                                | not started         |
| C12  | Welcome card asks two things at once; focus aids not offered there                                                                                                                        | Board wish for demo-a; check against the Fokus-Hilfen step | status unclear      |
| C15  | "Mittag 8,50" becomes a time; "Zug 7,45" becomes an expense without a time word                                                                                                           | Parser, S, rare                                            | not started         |
| D01  | Phone pairing path and device test (QR, real phone)                                                                                                                                       | Hardware test on Sven's devices; phone side in #559        | manual test         |
| D02  | Pairing dialog and menu use different names                                                                                                                                               | F1 in [d/FOLLOWUP.md](round-5/d/FOLLOWUP.md)               | LAN-sync chat       |
| D13  | Language switch in one window closes an open dialog                                                                                                                                       | F5, M                                                      | i18n / shell        |
| D14  | Dev-Preview fills test data on first start, no question                                                                                                                                   | F2 in [d/FOLLOWUP.md](round-5/d/FOLLOWUP.md)               | install-first-run   |
| D15  | Planner rows from test data end up in backups                                                                                                                                             | F3                                                         | planner (demo-a)    |
| D16  | "Passphrase" (docs, legal) vs "Passwortsatz" (UI)                                                                                                                                         | F6, glossary                                               | not started         |
| D17  | Imported notes get today's date, not the note's date                                                                                                                                      | F4, M, needs a repo option                                 | notes + core        |
| D18  | "Zuletzt abgeglichen" shows time only, no device, no count                                                                                                                                | F1                                                         | LAN-sync chat       |

## Known or decided – no action in this round

- C10: "Was kommt diesen Monat noch?" – covered by B's card "Diesen Monat" (demo-b).
- B11: budget named after its category is fine.
- C07: the extra "Buchen" step for finance captures stays (decision in features.md, Sven 2026-11-08).
- C13: undo after an app restart – known as V20, ROADMAP K4.
- C14: reminders in the PWA need a push server – known as B19; the message names the APK only.
- A F3: the planner stays off by default and in no profile (decided 2026-11-08).
