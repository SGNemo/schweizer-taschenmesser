# Import from other apps

"Aus anderer App importieren" (command palette, Settings → Sync & Backup, the migrate tiles of the setup assistant): pick the export files, Nemo unpacks ZIPs in a Worker, recognises the source from the content and opens the normal preview of the target module. Everything after the choice is the generic flow: duplicates unticked, batch id, undo, a report with what was imported, already there, left out and why. Texts: `t.importers`.

| Source | Files | Goes to | Notes |
|---|---|---|---|
| Todoist | CSV per project | todos | existed; sub-tasks, priority, due dates; repeats only as a hint |
| Google Tasks | JSON (Takeout) | todos | existed |
| Microsoft To Do | Outlook CSV (Tasks folder) | todos | To Do has no export of its own; headers matched in English and German, date style by file |
| Google Keep | Takeout JSON | notes | existed; attachments now counted |
| Google Calendar | `.ics` (Takeout `Calendar/`) | calendar | existed; TZID, RRULE, EXDATE |
| Evernote | `.enex` | notes | ENML → Markdown, tags, to-dos; images/attachments counted, not stored |
| Obsidian / Markdown folder | `.md`, ZIP | notes | front matter, `#tags`, wikilinks kept; top folder → notebook; hidden folders skipped; embeds counted |
| Notion | "Markdown & CSV" ZIP | notes | `Title <id>.md` pages: id dropped, property block kept, `Tags` → `#tags`, links between exported pages → `[[wikilinks]]`, wrapper folder skipped, top folder → notebook; images/files and CSV tables counted, not read |
| Feed and podcast apps | OPML (`.opml`, `.xml`), or pasted addresses | feeds | folders → groups, nested folders use the innermost name, non-http(s) addresses counted; the Feeds page exports the list as OPML 2.0 (`nemo-feeds-<date>.opml`); Spotify has no feed export (only podcast apps do) |
| Bitwarden / KeePass(XC) / 1Password | CSV | vault | mapping only in `accounts/csv.ts` (`importVaultCsv`); needs the master password, crypto untouched |
| German banks | CSV, CAMT, OFX, QIF | finance | presets for Sparkasse, DKB, ING, comdirect, N26 existed |

Todoist JSON backup is not read (the CSV is the documented export). The header names of the KeePass, 1Password and Outlook CSVs vary by version and language and could not be checked against official docs; the readers match aliases, so report an unknown header as a bug.

Formats were checked on 2026-11-03: Evernote DTD (`en-export`/`note`/`resource`, base64 data, ENML in CDATA) confirmed; KeePassXC header `Group,Title,Username,Password,URL,Notes,TOTP,…` from third-party docs; 1Password CSV columns per support.1password.com (Title, Website, Username, Password, one-time password, Favorite, Archived, Tags, Notes); Outlook classic exports tasks to CSV (File → Open & Export), To Do has none.

## Proposals for the follow-up module chats (visible changes, not done here)
- Notes: show the notebook chosen for an imported folder in the import preview detail line; offer "Nur Ordner X" in the wizard.
- Todos: map Todoist labels/Outlook categories to a real tag field once todos has one (now `#tag` line in the note).
- A first-class "Import" page with the report history (today: the batch list inside each module's wizard).
