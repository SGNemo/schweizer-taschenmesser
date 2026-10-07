# Changelog

Release notes are generated from Conventional Commits (`npm run changelog -- --version <x.y.z>` in `web/`); this file mirrors the published releases. Full lists with commit links: [GitHub Releases](https://github.com/SGNemo/schweizer-taschenmesser/releases).

## Unreleased

### Breaking
- **Messages, habit tracker and time tracking are no longer visible** (retired). Their data stays stored, keeps syncing and is part of every backup; the interface does not come back. If you need the data, export it beforehand with a backup (Settings → Backup).
- **Tools:** percent & VAT and split costs are now modes of the calculator, Base64, JSON, UUID and hash live in the "Developer" tool, and the scratch note is the pinned "scratchpad" at the top of Notes. Your saved tool selection is carried over.
- **Shopping list and packing lists are the new "Lists" module** (shopping, packing list, checklist), **Apps & links are the "Bookmarks" view of Saved** (tiles by first tag). Existing data is copied on start, after sync and after a backup import; the old modules are retired. **All devices must be updated**: an old device keeps writing into the old tables. The eight start-page templates of Apps & links are gone; `mailto:`/`tel:` links can only be saved again as http(s) in the bookmark editor.
- **Contracts & warranties merge into "Documents", birthdays and gift ideas into the new "People" module.** Existing data is copied on start, after sync and after a backup import; the old modules are retired. Gift ideas are assigned to the person with the same name, otherwise a new person is created. **All devices must be updated**: an old device keeps writing into the old tables. Reminder settings are carried over (Documents: its own lead time for notice periods).
- **Reminders are now calendar events of the type "Reminder"** (tab "Reminders"; `/reminders` redirects there). Existing reminders are copied on start, after sync and after a backup import, paused ones stay paused; the module is retired, and so is its dashboard widget (the entries appear in "Today & tomorrow"). **All devices must be updated**: an old device keeps writing into the old tables. The default time is carried over.
- **The old tables are removed** (messages, habits, time tracking, reminders, shopping, packing lists, apps & links, birthdays, gifts, contracts: 15 tables, database version 18). Their data has been copied into the new modules since 0.5–0.7; **anyone who still has data in one of these tables (devices < 0.7 that were never updated) loses it.** Backups from versions before 0.5 can still be read, the old tables in them are skipped (the preview shows how many); shopping, packing lists, contracts, birthdays, gifts and reminders from them do not come back.
- **System info** is a tab of "This PC" (formerly Disk); the path `/system` is gone.

### New
- **Turn on disabled modules right away:** when a notice names a disabled module (for example "Add to shopping list" in Pantry without Lists), there is an "Enable" button and the action runs right after. The same applies to the share page and to answers of the AI assistant.
- **Focus and attention aids (package 1 "Getting started"), each one can be turned off under Settings → Appearance → "Focus & attention":** "Up next" suggests a single task at the top of the overview (Start, Later, Something else); the day plan shows at most three things for today and what is already done; focus mode shows one task with steps and a ring timer without menus (state survives a reload, shown at the top, gentle ending); "Next" shows the time until the next event; to-dos have an estimated duration (also via quick capture: "… 15 min") and can be planned for today; "Important now" is calmer ("Still waiting" collapsed, no red day counter for old to-dos, "Replan" spreads them over the next days).
- **Calm reminders (package 2), all can be turned off under Settings → Notifications → "Calm reminders":** while the app is open, a due reminder appears as a card with "Done" and "Later" (10 min, 1 h, tonight, tomorrow morning, when I am at the PC). Quiet hours (22–7) for automatic extras, at most 3 notices per hour (the rest is combined into one notice), optional staggered reminders before events and a gentle follow-up. Instead of single to-do notices there is one notice in the morning that names today's to-dos. The end of a focus round can also be announced while the app is closed. "Where was I?" shows the way back on the overview after a longer break.
- **Capture, calm, find again (package 3):** quick capture no longer asks back on unclear text but puts it into the to-do inbox exactly as you typed it (can be turned off under Quick capture). Ctrl+Enter opens the full form with the typed text. "Sort inbox" goes through the inbox items one by one. Search (Ctrl+K) first shows what you used last (history on the device, can be deleted). Appearance: text size "Extra large", line spacing "Airy", "Motion: Less" inside the app and the calm overview "Only the essentials".
- **Visible progress without pressure (package 4), can be turned off under Settings → Appearance → "Focus & attention":** recurring to-dos show "n in a row" (a day off breaks nothing, you never lose anything), a friendly weekly review in "Up next", "Wrap up the day" in the evening (move what is left to tomorrow with one tap), and "From template" in Lists with morning routine, evening routine and weekly planning.
- **Calendar:** events can notify beforehand (from the start up to 1 day before, also for recurring ones); all-day events at an adjustable time.
- **To-dos:** tasks recur (ticking one off creates the next), "Someday" keeps tasks out of the open lists; recurring due dates appear in the calendar.
- Tool frame: `/tools/<id>`, command palette "Tool: …", Ctrl+. opens the tools; wider dialog, "Back" in the header.
- Time of the subscription reminder is adjustable; "Starter data" button also for contracts, packing lists, pantry, documents, gifts, budgets and notes.

### Fixed
- Subscription names no longer wrap letter by letter; "Add to shopping list" says when the shopping list is off; outdated texts (calendar, backup hint in the assistant, "Productive" profile) corrected.

## 0.3.1 (2026-10-01) – "Nemo 0.3.1"
Small update: new wordmark. Installations of 0.3.0 are offered it via in-app update; data stays intact.

### Changed
- New "Nemo" wordmark in clownfish style: the sidebar and the header show the lettering instead of just the fish icon.
- README header image and social-media preview image with the new wordmark and the claim.

### Fixed, security
- No changes.

### Notes
- **No breaking changes:** internal IDs, backup formats, database and updater endpoint are unchanged.
- **Known:** the device features (disk, Windows Hello, Android biometrics, sync with older devices) are still only checked by hand. Please report bugs.

## 0.3.0 (2026-10-01) – "Nemo 0.3.0"
First stable version under the name Nemo. It is the "latest version": installations of 0.2.0 are offered it via in-app update; data stays intact. It contains everything from 0.3.0-beta.1 (see below) plus the changes here.

### New
- New app icon (clownfish) and new "Nemo" wordmark.
- Plus everything from the pre-release: setup assistant, quick capture, disk and system info module (Windows), pantry, time tracking, gift ideas, tools text/time zones/image/PDF, flat design "Klar", MIT licence.

### Changed
- Internal improvements to build and tests (faster checks). No change in the app's behaviour.

### Fixed
- The release check of the download links read its parameters wrongly (build tool only, does not affect the app).

### Security
- No new changes compared to 0.3.0-beta.1 (encrypted backups, device tokens, sync vault v2, encrypted backup copies before updates).

### Notes
- **No breaking changes:** internal IDs, backup formats and updater endpoint are unchanged; old backups can still be imported. The local database is migrated to version 13 automatically on first start.
- **Download names:** files are now called `Nemo-Portable.exe` and `Nemo.apk`; the previous `Taschenmesser-*` files are included as copies so installed apps can keep updating.
- **Known:** device features (disk, Windows Hello, Android biometrics, sync with older devices) are only checked by hand. Please report bugs.

## 0.3.0-beta.1 (2026-09-30) – "Nemo 0.3.0-beta.1" (pre-release)
Pre-release for trying out: it does not appear as the "latest version" and is not offered automatically via app update. Installing over an existing installation keeps all data.

### New
- **Nemo:** new name, new logo ("Wave") and a calm, flat design with accent colours (light/dark).
- **Setup assistant** for getting started (manual, never forced).
- **Quick capture:** keyboard shortcut, tray icon and autostart (Windows), share target (Android), input in everyday language.
- **Disk (Windows):** scan drives, treemap, clean-up helpers, duplicate files; deleting only with a block list, recycle bin by default and confirmation by typing the name.
- **System info (Windows):** CPU, memory, battery, graphics, network.
- **New modules:** pantry, time tracking, gift ideas.
- **New tools:** text, time zones, image, PDF.
- Licence: MIT.

### Changed
- Short README with user documentation under `docs/user/`.
- All files are now called Nemo-*; the previous Taschenmesser-* files are included as copies so installed apps can keep updating.

### Fixed
- Android: share target did not build (Android 12+), status bar icon for notifications.
- Wrong day in the timestamp of the last sync.

### Security
- Encrypted backups with a check before restoring; automatic backups (Windows).
- Sync: device tokens, lockout after failed attempts, new vault (Argon2id), conflict log.
- Backup copies before updates are encrypted.

### Notes
- **No breaking changes:** internal IDs, backup formats and updater endpoint are unchanged; old backups can still be imported. The local database is migrated to version 13 automatically on first start.
- **Known:** the device features (disk, Windows Hello, Android biometrics, update over an existing installation) are only checked by hand. Please report bugs.
- **Pre-release:** download the Windows portable and the APK by hand from the releases page (a SmartScreen notice for the EXE is expected).

## 0.2.0 (2026-09-30) – "Taschenmesser 0.2.0"
### Breaking changes
- **windows:** portable executable with its own signed self-update; Windows installers are no longer published.
### Features
- **mcp:** stdio MCP server wrapping the local import API
- **localapi:** loopback-only AI import API for the desktop app; import batches wait for confirmation, with diff and undo
- **dataapi:** import format from module schemas and JSON paste import
- map and WhatsApp links, share page and the Apps & Links module
- **tools:** toolbar, tool library, 14 tools and palette calculator
- **news:** RSS/Atom news module with local article cache, starter pack and an explicit AI brief
- **connectors:** Google calendar and mail suggestions, ICS subscriptions, external calendar events; connector types, PKCE helpers, redaction and a loopback OAuth listener
- **server:** SSRF-hardened proxy for public calendar and feed URLs
- **onboarding:** start-data wizard, importers per module, bank statements and HelpHint
- **layout:** PageContainer layout system and wide-screen module layouts
- **security:** OS keystore, biometric vault unlock and screenshot protection
- **ai:** multiple providers with a fallback router, limits and encrypted keys
- **accounts:** encrypted password vault, fully excluded from the AI
- **update:** self-update for desktop and Android with pre-update backup
- **android:** Tauri Android setup, APK installer plugin, OS-scheduled reminders
- **desktop:** embed the web app in a Tauri 2 shell behind a PlatformService
### Bug fixes
- **localapi:** request deadline and a cap on waiting imports
- pad VAPID private keys to 32 bytes; bundle connector settings UIs with the settings page
- **ai:** concurrent provider changes no longer overwrite each other; hash-wasm kept out of the main bundle; saving a provider form no longer reverts its switch
- **android:** apk-installer plugin compiled against API 36
### Build & CI
- secret scan (gitleaks), release artifact audit, keystore cleanup, signed release pipeline, download README

## 0.2.0-beta.2 (2026-09-30)
First portable Windows build; connectors, news, tools, start-data wizard, layout system (see 0.2.0).

## 0.2.0-beta.1 (2026-09-29)
Desktop and Android shells, self-update, password vault, multi-provider AI, OS keystore and biometrics, CI and signed releases. Earlier phases 1–6 (PWA foundation, recurrence engine, finance, sync server with end-to-end encryption, AI assistant, extra modules) were developed on `develop` without releases.
