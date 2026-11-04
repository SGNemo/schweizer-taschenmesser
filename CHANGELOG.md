# Changelog

Generated from the change notes (`.changes/`) at release time; German version: [CHANGELOG.de.md](CHANGELOG.de.md). What came after the latest release lives as notes in `.changes/`.

## [1.0.0] – 2026-10-07

### Breaking changes
- **App:** Data of the old modules (shopping, packing lists, apps & links, birthdays, gifts, contracts, reminders, habits, time tracking, news) is not carried over from 0.3.x. Back it up first under Settings → Backup.
- **App:** The database moves to version 19; no older app can open this data afterwards. Bring all devices connected by sync to the same version.
- **Installation:** Installations up to 0.2.x can no longer update themselves and must be reinstalled.

### Highlights
- **AI:** AI entries in every module with preview and undo, a local model and a master switch to turn AI off.
- **App:** New “Klar 2” interface with a home overview, areas, sidebar, searchable settings and keyboard shortcuts.
- **App:** Five languages: German, English, Spanish, French and Portuguese (Brazil).

### Added
- **App:** Report bugs with a preview, a recovery screen and a safe mode.
- **Calendar:** Advance notifications and recurring todos.
- **Readability:** Focus and reading aids: “Next up”, day plan, focus mode, calm reminders, reading aid, larger text, less motion. All can be switched off.

### Changed
- **App:** Modules reorganised: lists, people, documents, calendar with reminders; tools reduced from 18 to 12.

### Security
- **App:** Security review before launch; CodeQL findings handled.

## [0.3.1] – 2026-10-01

### Changed
- **App:** New “Nemo” wordmark in clownfish style in the sidebar and header.

## [0.3.0] – 2026-10-01

### Highlights
- **App:** First stable version under the name Nemo with a new icon and wordmark; data stays intact on update.

### Added
- **App:** Setup assistant, quick capture, “This PC” module, pantry, time tracking, gift ideas, new tools and the flat “Klar” design.

### Changed
- **Installation:** Files are now called Nemo-Portable.exe and Nemo.apk; the old Taschenmesser files are included as copies so updates keep working.

### Security
- **Sync:** Encrypted backups, device tokens and a new sync vault; backup copies before updates are encrypted.

## Older changes

Versions 0.3.0-beta.1 and everything before 0.3.0 are summarised here: the rename to Nemo (new logo, flat design), setup assistant, quick capture, disk and system info (Windows), pantry, time tracking, gift ideas, new tools; encrypted backups and the new sync vault. Before: portable Windows app with signed self-update, Android shell, password vault, multi-provider AI, connectors, news, local import API and MCP wrapper (0.2.0), and phases 1–6 (PWA foundation, recurrence, finance, end-to-end encrypted sync, AI assistant, extra modules) developed without releases. Per-commit lists: [GitHub Releases](https://github.com/SGNemo/schweizer-taschenmesser/releases).
