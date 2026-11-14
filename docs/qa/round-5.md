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

Fixed in `fix/round5-rests` (round 2026-11-14), one line per id:

- A11: the migrate step stays counted once offered (`core/setup/migrate.ts`, flag `migrate.offered`).
- B10: the bank preview names up to three skipped rows by line, reason and payee (`core/io/bank.ts` `skippedRows`).
- C11: checked – the overview fills right after „Mit Testdaten ansehen“ without a reload (already in `develop`).
- D02: the pairing texts name the path „Einstellungen → Sync & Backup“ (`strings.lanSync.ts`, `docs/user/sync*.md`).
- D13: a language switch from another window waits until this window's dialog is closed (`core/i18n/lang.ts`).
- D14: already fixed by #766 – the welcome card asks („Mit Testdaten ansehen“), nothing fills at start-up.
- D16: „Passwortsatz“ as in the glossary in `docs/user/sync.de.md`, the legal text and the sync help.
- D18: „Zuletzt abgeglichen“ is the one name (server and home network) and shows the change count of the last cycle.

Fixed in `fix/notes-import-dates`:

- D17: imported Markdown notes keep `created:`/`date:` (else the ZIP or file date) as `createdAt` and `modified:` as `updatedAt` (`createMany` option `at`, `decisions/core-data-ai.md`).

## Open – no PR yet

| Id   | Finding                                                                                                                                                                                   | Next step                                                  | Owner            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------- |
| A12  | Outer display (320 × 332): app shows only header and bar                                                                                                                                  | Follow-up F1: Android "Heute" widget, three packages       | not started      |
| B-fu | Balance date for later imports (decision: data model); reconciled marker; Sparkonto counted in "Diesen Monat"; two Konto-Dialog items (error placement, locked field shows the old value) | [b/FOLLOWUP.md](round-5/b/FOLLOWUP.md)                     | Sven (decision)  |
| D11  | Section "Was ging wohin?" set to stable; open question on its wording                                                                                                                     | Question to Sven (commit `92a2ae37`)                       | Sven             |
| C12  | Welcome card asks two things at once; focus aids not offered there                                                                                                                        | Board wish for demo-a; check against the Fokus-Hilfen step | status unclear   |
| C15  | "Mittag 8,50" becomes a time; "Zug 7,45" becomes an expense without a time word                                                                                                           | Parser, S, rare                                            | not started      |
| D01  | Phone pairing path and device test (QR, real phone)                                                                                                                                       | Hardware test on Sven's devices; phone side in #559        | manual test      |
| D15  | Planner rows from test data end up in backups                                                                                                                                             | F3                                                         | planner (demo-a) |

## Known or decided – no action in this round

- C10: "Was kommt diesen Monat noch?" – covered by B's card "Diesen Monat" (demo-b).
- B11: budget named after its category is fine.
- C07: the extra "Buchen" step for finance captures stays (decision in features.md, Sven 2026-11-08).
- C13: undo after an app restart – known as V20, ROADMAP K4.
- C14: reminders in the PWA need a push server – known as B19; the message names the APK only.
- A F3: the planner stays off by default and in no profile (decided 2026-11-08).
