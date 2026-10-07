# Module and tool plan – Nemo (target picture B, decided 2026-10-01)

Derivation and reasoning: [MODULE-REVIEW-2026-10-01.md](../archive/2026-10/MODULE-REVIEW-2026-10-01.md) (archived, German). Implementation prompts: [MODULE-IMPLEMENTATION-PROMPT.md](../archive/2026-10/MODULE-IMPLEMENTATION-PROMPT.md) (archived, German). Packages 1–6 are released (see [CHANGELOG](../../CHANGELOG.md)); package 7 is open. Status: **changed** = module stays (same ID), **new** = new ID, **merged** = data is copied, **area** = UI only, **retired** = invisible, tables stayed until package 6, **removed** = code gone. German UI names in quotes.

## Modules (target: 9 nav entries + "Dieser PC" on desktop)
| Nav entry | Module ID(s) | Scope | Status | Prio | Package |
|---|---|---|---|---|---|
| Calendar ("Kalender") | `calendar` ← `reminders` | events with `kind` (event/reminder) and `notify`; tab "Reminders"; notifications; 8 templates; month/week/day; external calendars | merged | high | 5 |
| To-dos ("ToDos") | `todos` | lists, priority, due, subtasks, **recurrence**, **someday**, tick off in the widget | changed | high | 2 (widget), 5 (recurrence) |
| Money ("Geld") | area `money` (design): `finance`, `invoices`, `subscriptions`, `budgets` | area page with sub-tabs (design PR 2); subscription reminder time as a setting; subscription tile fix | area | high | design 2 (area), 1 (fixes) |
| Lists ("Listen", area household) | **`lists`** (new, ← `shopping`, `packing`), `pantry` | list kinds shopping / packing list / checklist, templates; pantry unchanged in the same area | new + merged; `pantry` changed | high | 3 |
| Notes ("Notizen") | `notes` ← tool `scratch` | pinned "scratchpad" (id `scratch`, widget), checklists in text, pinning, search, StartDataButton | changed | high | 1 |
| Saved ("Merkliste") | `bookmarks` ← `launcher` | kinds + **bookmarks** (tiles, groups by tag), browser import, share target | changed, `launcher` merged | high | 3 |
| People ("Personen") | **`people`** (new) ← `birthdays`, `gifts` | person (birthday, note, tags), gifts per person; age, WhatsApp, calendar items, reminder; gifts invisible to AI | new + merged | medium | 4 |
| Documents ("Unterlagen") | `vault` (new UI name) ← `contracts` | document with category, provider, term, notice period, file (local until K3); deadlines in the calendar + reminder; mail scan | changed, `contracts` merged | medium | 4 |
| Accounts | `accounts` | unchanged; mobile header; later password health | changed (small) | high | 1 (fix), 7 (S1) |
| This PC ("Dieser PC", desktop) | `disk` ← `system` (UI) | tabs drives · system; Rust unchanged | changed, `system` removed (UI) | medium | 1 |
| – | `news` | module, `core/ai/newsBrief.ts`, starter pack, `e2e/news.spec.ts` | retired (code gone, tables stayed until 6) | – | 1 |
| – | `habits`, `timetrack` | unused; data stays exportable | retired | – | 1 |
| – | `reminders`, `shopping`, `packing`, `launcher`, `birthdays`, `gifts`, `contracts` | after the copy | retired | – | 3–5 |
| – | all retired tables | out of the schema, `schema-upgrade.test` adjusted | removed (database version 18) | – | 6 |
| – | `example` (dev) | unchanged | – | – | – |

Mobile nav: Overview · Calendar · To-dos · Money · More. Library: groups with indented sub-modules, each one can be turned off on its own.

## Tools (target: 12)
| Tool | From | Status | Package |
|---|---|---|---|
| Calculator (modes expression · percent/VAT · split) | `calc`, `percent`, `split` | merged (ID `calc`) | 1 |
| Developer (tabs Base64/URL · JSON · UUID · hash) | `base64`, `json`, `uuid`, `hash` | merged (ID `dev`) | 1 |
| Scratch note | `scratch` | removed → Notes "scratchpad" | 1 |
| Currency, timer & stopwatch, QR code, units, date calculator, time zones, dice & random, text, images, PDF | – | unchanged (file picker as a button) | 1 |
| Frame | – | route `/tools/:id`, palette, shortcut, dialog up to 900 px, "Back" in the header, settings ID migration | 1 |

## New core building blocks
| Building block | Package | Purpose |
|---|---|---|
| `manifest.area` (design PR 2, not this plan) | design 2 | areas plan · money · household · knowledge · vault · system; replaces the `manifest.group` planned here before |
| `manifest.retired: true` | 1 | module without routes/nav/widget/AI/import API, collections stay in the schema; `exclusion.test` and `BLOCKED_MODULES` know the state |
| Widget actions (`WidgetList` + `home/`) | design 4 | tick off, paid, snooze, size; lives in design PR 4, package 2 of this plan is dropped |
| App migration `core/db/appMigrations.ts` | 3 | idempotent forward copy (same `id`, `updatedAt` comparison), runs after opening the DB, sync pull, backup import; fixture tests with 0.3.1 backups |
| `event.notify` + calendar `notifications` | 5 | event notifications (prerequisite for reminders) |

## Packages
| # | Name | Version | Breaking | Depends on |
|---|---|---|---|---|
| D1, D2 | design PRs tokens, shell + areas (`docs/design/IMPLEMENTATION-PROMPT.md`) | – | no | – |
| 1 | Clean-up (retiring, tools, scratchpad, this PC, findings) | 0.4.0 | yes (messages, habits, time tracking invisible) | D2 |
| D3, D4 | design PRs components, home (contains the overview actions; package 2 is dropped) | – | no | D1, 1 |
| 3 | Lists + bookmarks (+ migration runner); new modules in the new style | 0.5.0 | yes | 1, D3 |
| 4 | Documents + people (new style) | 0.6.0 | yes | 3 |
| D5a–5d | design module PRs only for modules that stay (5b = calendar, to-dos; 5c = pantry, notes, saved; 5d without system info) | – | no | D2, D3 |
| 5 | Time (reminders → calendar, to-do recurrence) | 0.7.0 | yes | 3 |
| 6 | Remove tables | 0.9.0 / 1.0.0 | yes (all devices ≥ 0.7) | 5 |
| 7 | Password health (S1): UI only in `accounts`, weak/reused/old passwords via zxcvbn, opt-in HIBP range check (k-anonymity, via `getPlatform().fetch`), crypto unchanged | after 6 or in parallel from 4 | no | – |

Roadmap (no date): K3 attachments in sync/backup, M2 calendar drag/resize, M3 budget carry-over, messages as an optional extension, timer ↔ time tracking (dropped).
