# Chats – running work and hand-over

Several Claude chats work in parallel and only see each other through GitHub. `cd web && npm run chats:status` lists the other branches, their files and the overlap with yours; notes and questions between chats go to [`scribble/`](../scribble/README.md) (develop only). Keep this file short; delete finished rows. Last full review: 2026-10-02.

## Wartet auf Sven
Everything that needs a decision or a merge from the maintainer, in one place. A chat adds a row when it stops for him and removes it when done. Source of truth for PRs: GitHub (`list_pull_requests`).

| Was | Was zu tun ist |
|---|---|
| Entwurfs-PRs #27, #29, #30, #31, #32, #33 (`alert-autofix-*`, Code-Scanning-Vorschläge) | ansehen, annehmen oder schließen (Sicherheitsbereich, kein Chat fasst sie an) |
| Entscheidungen aus [STATUS](STATUS.md) „Nächste sinnvolle Schritte“ 6 | Spotify-Widget, Precache der Wörterbücher, „+ Neu“ statt FAB |
| Fehlerberichte/Absturzfestigkeit: PRs #85 → #87 → #88 → #92 (gestapelt, Reihenfolge einhalten; #84 ist gemergt) | nacheinander mergen; Basis springt jeweils automatisch auf `develop` |
| Fehlerberichte: echte Mail-Adresse | `REPORT_MAIL` in `web/src/core/diagnostics/config.ts` eintragen (`.invalid` blendet „Per Mail melden“ aus) |
| Fehlerberichte: Launch-Checkliste | [LAUNCH-CHECKLIST](LAUNCH-CHECKLIST.md) auf frischer Windows-VM und Android-Gerät abhaken (Installation, SmartScreen, Update N→N+1, Deinstallation, Sicherer Modus) |
| Fehlerberichte: Rust im CI prüfen | nach Merge von #87/#92 `Native shell (fmt, clippy, tests)` grün? (`desktop_safe_mode`, `desktop_take_panic_log` wurden lokal nicht gebaut); Handtest: `Nemo-Portable.exe --safe-mode` |
| [PR #57](https://github.com/SGNemo/schweizer-taschenmesser/pull/57): Fokushilfen Paket 1 „Anfangen“ | ansehen, mergen (zuerst) ([focus-aids](features/focus-aids.md)) |
| [PR #58](https://github.com/SGNemo/schweizer-taschenmesser/pull/58): Fokushilfen Paket 2 „Erinnerungen“ (gestapelt auf #57) | nach #57 mergen; Basis wird automatisch auf `develop` umgestellt |
| [PR #59](https://github.com/SGNemo/schweizer-taschenmesser/pull/59): Fokushilfen Paket 3 „Erfassen, Ruhe, Wiederfinden“ (gestapelt auf #58) | nach #58 mergen; Basis wird automatisch auf `develop` umgestellt |
| [PR #60](https://github.com/SGNemo/schweizer-taschenmesser/pull/60): Fokushilfen Paket 4 „Fortschritt“ (gestapelt auf #59) | nach #59 mergen; Basis wird automatisch auf `develop` umgestellt |
| PR „App-UI in 5 Sprachen“ (`feat/i18n-ui`, PR 2/2 nach #86) | ansehen, mergen; danach brauchen neue Texte alle 5 Sprachen (`npm run check:i18n`); Repo-Felder aus [meta/REPO-SETTINGS.md](meta/REPO-SETTINGS.md) setzen, falls noch offen |

## Läuft gerade (Running work)
| Topic | Branch | Area / files | State | Last commit | Updated |
|---|---|---|---|---|---|
| Focus audit 2, package 2b: calm ToDo page ("⋯" menu, no FAB with an add field, "Wartet noch" once) | `feat/focus2-todos` | `web/src/modules/todos/routes/TodosPage.tsx`, `web/src/core/shell/**`, `layout/AppShell.tsx`/`AreaFrame.tsx` (small), `ui/RowMenu.tsx`/`GroupedList.tsx` (additive) | building | – | 2026-10-18 |
| Chat coordination: scribble folder, `chats:status`, CI guard for main | `chore/chat-scribble` | `scribble/`, `web/scripts/chats-status.mjs`, `ci.yml`, root `CLAUDE.md` step 2 | PR open | – | 2026-10-17 |
| (announced) Voice key for the AI input | `feat/voice-ask` | `core/keyboard/shortcuts.ts`, `layout/assistant/*`, new `core/ai/voice/*`, settings section, `src-tauri` global shortcut | prompt in [product/focus/13-parallel-prompts.md](product/focus/13-parallel-prompts.md) | – | 2026-10-17 |
| (announced) Reminders from an AI sentence | `feat/ai-reminders` | `core/ai/intent`, `core/ai/write/*`, `modules/calendar/ai.ts`, `WritePreview.tsx` | prompt in 13-parallel-prompts | – | 2026-10-17 |
| (announced) Quiet ping in game mode (own sound) | `feat/quiet-ping` | `core/notifications/service.ts`, new `core/notifications/sound.ts`, notifications settings, `src-tauri` (system-info/capture) | prompt in 13-parallel-prompts | – | 2026-10-17 |
| (announced) Reminder repeats until answered | `feat/reminder-repeat` | `core/notifications/{policy,collect,ack,snooze,scheduler,nativeSchedule,pushPayload}.ts` | prompt in 13-parallel-prompts | – | 2026-10-17 |
| (announced) Focus package 2 – home 'Heute' card, pins, calm ToDos page | `feat/focus2-today` | `home/*`, `modules/todos/{widgets,routes}`, `modules/calendar/widgets` | prompt in 13-parallel-prompts | – | 2026-10-17 |

How: add your row in the **first commit** of your branch (or in a draft PR as early as possible), update State/Last commit when you push something notable, remove the row in the **last commit** of your PR. On a merge conflict here keep both rows. Source of truth for live work is GitHub: `list_pull_requests` / branch list; this table adds topic and area.

## Hotspots (many chats edit them – announce first)
| File / area | Rule |
|---|---|
| root `CLAUDE.md` | only when a root rule changes; own PR, merge quickly |
| `web/src/strings.ts` | append inside your module's block only; never reorder or reformat others |
| `web/src/core/modules/types.ts`, `core/modules/registry.ts` | manifest contract: one chat at a time (add a row here saying so) |
| `web/src/core/platform/types.ts`, `core/platform/tauri/index.ts`, `core/platform/web.ts` | platform seam: one chat at a time |
| `web/src/ui/tokens.css` (+ `tokens.test.ts`) | token changes: one chat at a time |
| `web/package.json`, lock files, `web/src-tauri/Cargo.toml`/`Cargo.lock` | add dependencies in a small separate commit; lock files regenerated by tools, never hand-merged |
| `core/db/schema.snapshot.json`, Dexie version (`npm run db:bump`) | on conflict re-run `db:bump` after merging `develop`; never hand-edit |
| `web/src/pages/Settings.tsx`, `layout/AppShell.tsx`, `router.tsx` | keep edits small and local to your section |
| `docs/STATUS.md`, `docs/DECISIONS.md`, `docs/HOW-TO.md`, `docs/ARCHITECTURE-MAP.md`, `README.md` | touch only on real change; one line / one block, no reformatting |

## Hand-over conventions
- PR description = hand-over: **Done / Open / Next / How to verify**, links to files, no history.
- Unfinished work: push the branch, keep the row with State `paused – <what is missing>`, list open items in the PR.
- A chat that finds a problem outside its scope: note it in the PR text (or open an issue), do not fix it silently; the next chat picks it up from there.
- Do not merge another chat's PR; do not push to another chat's branch.
- Decisions that change a root rule or a hotspot contract go into DECISIONS.md in the same PR.
