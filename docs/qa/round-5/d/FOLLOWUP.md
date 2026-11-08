# Follow-ups D (not built here: other owner, > M or cross-module)

Findings: [FINDINGS.md](FINDINGS.md). Each block is a prompt sketch for a later chat.

## F1 · Phone pairing text and one name (D01, D02, D18) – LAN-sync chat
Owner: the LAN-sync chat (package 3b is merged; files `strings.lanSync.ts`, `SyncSection.tsx`, `LanClientSection.tsx`).
> In the PC pairing dialog name the phone's path with the words the phone shows (today „Einstellungen → Synchronisation → „Mit PC koppeln““, the menu says „Sync & Backup“). On both sides add one sentence: „Zuletzt mit <Gerätename> abgeglichen: vor 2 Min, 14 Änderungen“ (device name from the trust list, count of ops of the last cycle). Test: unit test of the sentence; e2e with the fake hub/client.

## F2 · Dev-Preview: empty start on request (D14) – install-first-run
Owner: `docs/install-first-run` (first start).
> The Dev-Preview fills invented test data on the first start (`core/seed/dev.ts` `autoFillIfEmpty`) before the person decides anything; a tester who imports their own notes gets them mixed with 12 example notes. Ask once on the first start: „Mit Beispieldaten ansehen“ / „Leer starten“ (default Beispieldaten, as today). Never in stable builds (`core/seed/devFlag.test.ts`).

## F3 · Derived planner rows of test data (D15) – planner owner (demo-a)
> Planner rows computed from seed items (`planner_assignment`, `planner_item` with `seed-…` sources) are not registered as seed, so they go into backups and stay after „Testdaten entfernen“. Register them in `_seeds` or skip rows whose source is seeded. Test in `core/seed/registry.test.ts`. Then the dev hint in `strings.dev.ts` („kein Backup“) is true again.

## F4 · Keep the note date on import (D17) – notes + core
> Imported Markdown notes get „today“. Read `created:`/`date:` from front matter (and the ZIP entry date) and store it as `createdAt` (and `updatedAt` = `modified:` if present). Needs a `createRepo` option to accept an envelope date from an import (core contract, hotspot). Test: an Obsidian fixture with `created: 2025-12-01` sorts below today's notes under „Zuletzt geändert“.

## F5 · Dialog survives a language switch (D13) – i18n / shell
> Switching the language in one window remounts the app in every window and closes an open dialog (seen with the notes import dialog, nothing typed was lost). Keep the tree mounted (texts are read at render time) or restore the open dialog. Test: e2e with two pages of one context.

## F6 · One word for the sync passphrase (D16) – glossary
> UI says „Passwortsatz“ (`strings.ts` `sync.passphrase`), `docs/user/sync(.de).md` and `strings.legal.ts` say „Passphrase“. Pick one in `docs/i18n/GLOSSARY.md` and align docs and legal text (legal text: maintainer review).
