# Findings D – Daniel (Systemintegrator, LAN sync, offline, backup, notes import)

Persona: [PERSONA.md](PERSONA.md). Run 2026-11-08 on `develop` (`37fc11bd`) with `npm run dev:all` (Dev-Preview flavour, test data fills an empty app). PC = 1920 × 1080 light; phone = 412 × 915 dark, Samsung UA. The LAN hub only exists in the Windows app; its PC side was looked at in the E2E build with the stand-in hub (`core/platform/fakeLanHub.ts`), the phone side is not on `develop` yet (package 3b runs on `feat/lan-sync-phone`). Scripts: Playwright, not committed (scratch); fixture: `web/e2e/fixtures/obsidian-d/Vault/`.

## Numbers before / after

| Step | Before | After |
|---|---|---|
| First start with the setup assistant | 3 questions, 4 clicks, ~7 s to the overview, 0 requests | unchanged (setup belongs to demo-a) |
| Task 1: pair PC and phone, one note on both | not possible: the phone has no "Mit PC koppeln" ([before-lan-3-phone](shots/before-lan-3-phone.jpg)) | unchanged, LAN-sync chat (D01) |
| Task 2: backup → fresh device → restore | 6 clicks, ~15 s; user rows identical (37 of 37; `null` fields come back as absent, same value for the app); status still says "Kein Backup" | same, status "Gesichert · Als Datei: …" ([after-backup-status](shots/after-backup-status.jpg)) |
| Task 3a: Notizen → Importieren → "Ordner wählen" (vault) | 5 clicks, ~6 s; **1** notebook "Vault", 0 of 3 folders kept, "!schaltplan.png" left in the text | 5 clicks, ~6 s; **3** notebooks `10_Arbeit`, `20_Privat`, `90_Archiv`, sub-folder as `#Projekte`, no leftovers ([after-import-3-list](shots/after-import-3-list.jpg)) |
| Task 3b: Modul-Bibliothek → Importieren → ZIP | notebooks in ZIP order 10/90/20, `Projekte` lost, "1 Datei ist nicht lesbar" (the `.obsidian` settings) | 10/20/90, `#Projekte`, no false message ([after-import-4-wizard](shots/after-import-4-wizard.jpg)) |
| Network, 24 pages + palette (~70 s) | **0** requests outside the app | 0 |
| "Was geht ins Netz" | log hidden behind "In Arbeit anzeigen", no forward list | visible; 13 reasons, 27 fixed hosts, checked against the code on every test run ([after-net-catalogue](shots/after-net-catalogue.jpg)) |
| Seconds to the first finished task (import, from the notes page) | ~6 s, but the result is not what he wanted | ~6 s, sorted like his vault |

## Findings

Severity: **Abbrecher** (he puts the app away) · Stolperstein · Kosmetik.

| Id | Step | Expected / actual (his words) | Severity | Where | Fix | Effort | Status |
|---|---|---|---|---|---|---|---|
| D01 | Task 1 | "The PC shows a QR code and says: on the phone open Einstellungen → Synchronisation → „Mit PC koppeln“. That button does not exist on my phone." | Abbrecher | `strings.lanSync.ts:67`; phone side missing | package 3b (`feat/lan-sync-phone`) | L | Board an LAN-Sync-Chat |
| D02 | Task 1 | "The dialog says „Synchronisation“, the menu says „Sync & Backup“. Which one?" | Stolperstein | `strings.lanSync.ts:67` vs settings title | one name in the pairing text | S | Board an LAN-Sync-Chat |
| D03 | Task 3a | "I picked my vault folder and got one notebook called „Vault“. My folders are gone, the picture link is still in the text." | Abbrecher | `modules/notes/exchange.ts:70` | a picked folder with sub-folders is read like the vault importer (root dropped, sub-folders = notebooks, hidden folders skipped, embeds removed); hint text says so | S | gefixt (`a9396ed9`, hint `strings.ts:4185`) |
| D04 | Task 3a/3b | "`10_Arbeit/Projekte/Netzplan.md` lands in 10_Arbeit, the „Projekte“ part is lost." | Stolperstein | `importers/obsidian/parse.ts` | deeper folders become one nested tag (`#Projekte`, `#Projekte/Kunde-A`); notebooks stay flat | S | gefixt (`0ba52a64`) |
| D05 | Task 3b | "Notebooks come out 10, 90, 20 – I number my folders for a reason." | Kosmetik | `modules/notes/importer.ts:57`, `components/ImportDialog.tsx:47` | numeric sort of new notebooks | S | gefixt (`62e366f4`) |
| D06 | Task 3b | "„1 Datei ist nicht lesbar“ – which one? (It was `.obsidian/app.json`.)" | Stolperstein | `modules/notes/importer.ts:94` | hidden export folders are left out before reading | S | gefixt (`62e366f4`) |
| D07 | Task 2 | "I just downloaded a backup and the status says „Kein Backup“." | Stolperstein | `pages/settings/useSettingsStatus.ts:147` | device-local "last file backup" (`core/backup/lastBackup.ts`, time + encrypted only); head shows the newer of file and automatic backup | S | gefixt (`ad608955`, `863b0880`) |
| D08 | Task 2 | "„37 Einträge in 40 Tabellen“ – I have one note." | Kosmetik | `pages/settings/BackupSection.tsx:151` | count only tables that hold rows, singular/plural | S | gefixt (`30a45c4d`); the 36 other rows are planner rows derived from test data → D15 |
| D09 | Network | "The log files Groq, Mistral and OpenRouter under „Sonstiges“, not KI. And I want the list of what *can* go out, not only what went." | Stolperstein / wish | `core/net/netlog.ts:146`; new `core/net/catalogue.ts` | AI hosts mapped; folded list "Was überhaupt ins Netz gehen kann" from the code, test scans the source both ways | S/M | gefixt (`7680cd52`, `62aeedb4`) |
| D10 | Task 2 / wish | "The plain backup is one 1-MB line. What is `_f`?" | Kosmetik / wish | `core/backup/encrypted.ts:88` | indented JSON, `about` field with the format in one line and a link; "Dateiformat" in `docs/user/backup(.de).md`; lossless re-import pinned by a test | S | gefixt (`7ab7d094`) |
| D11 | Network | "„Was ging wohin?“ and „Netzwerk sperren“ only show up with „In Arbeit anzeigen“. That is the one page I came for." | Stolperstein | `pages/settings/sections.tsx:887` | section `network` → `stable` (was set to preview in bulk with T3) | S | gefixt (`92a2ae37`), Frage an Sven |
| D12 | Settings | "„Zugangsschlüssel“ in the step, „Zugangstoken“ in the field." | Kosmetik | `strings.settingsConnect.ts:13` | same word | S | gefixt (`98bcc9eb`); "Passphrase" (docs, legal) vs "Passwortsatz" (UI) → D16 |
| D13 | Disturbance | "Language switched in the second window: the open import dialog in the first window just closed." | Kosmetik | app remount on language change (`core/i18n`) | keep dialogs open or restore them | M | Follow-up |
| D14 | First start | "Before I typed anything there were 12 example notes (Privat, Arbeit, Ideen). My vault landed in between." | Stolperstein | `core/seed/dev.ts:385` `autoFillIfEmpty` (Dev-Preview only) | Dev-Preview: ask on first start ("Mit Beispieldaten" / "Leer starten"); same root as demo-a A10 | S | Board an install-first-run |
| D15 | Task 2 | Planner rows computed from test data (33 + 3) go into the backup; after a restore they differ from the fresh device's own rows. | Kosmetik | `core/seed/guard.ts` / planner write-back | register derived rows as seed or skip them | S | Board an demo-a (Planer) |
| D16 | Naming | Docs and legal text say "Passphrase", the sync form says "Passwortsatz". | Kosmetik | `docs/user/sync(.de).md`, `strings.legal.ts` | one word (glossary) | S | Follow-up (files of the LAN-sync chat / legal) |
| D17 | Task 3 | Front matter `created:` and file dates are not kept; every imported note is "today". | Stolperstein | `core/io/markdownNote.ts`, notes `createRepo` | keep the date as `createdAt` (needs a repo option) | M | Follow-up |
| D18 | Wish | "One sentence: zuletzt mit PC abgeglichen, vor 2 Min, 14 Änderungen." Today: time only, no device, no count. | wish | `LanHubSection.tsx` `lastSyncedText`, `SyncSection.tsx` | sentence from the sync status | S | Board an LAN-Sync-Chat |

Not a finding (checked): two windows see each other's new note at once; clock +3 days / −1 year: no error, dates follow; diagnostics preview holds only numbers, settings and versions (no titles, hosts, paths); offline: the app keeps working, a reload offline needs the built PWA (dev server has no service worker; `e2e/offline.spec.ts` covers it).

## Focus checklist (UI changes)
- D07 status line: replaces a wrong sentence, no new element. D09 list: folded by default (one `details` row), no colour, hosts in `code` (no reading aid). D11: an existing section becomes visible, nothing new on other pages. D03 hint: one sentence longer. Nothing could be removed instead: each change replaces a wrong or missing statement.

## Verdict in his words
„Es ging nichts raus, was ich nicht angestoßen habe, und die Liste, was überhaupt raus kann, ist genau das, was ich für meine Firewall wissen will. Backup und Import machen jetzt, was ich erwarte: mein Vault kam mit seinen Ordnern an, das Backup kann ich im Editor lesen. Auf dem PC behalte ich die App; aufs Handy kommt sie an dem Tag, an dem das Handy den QR-Code scannen kann.“
