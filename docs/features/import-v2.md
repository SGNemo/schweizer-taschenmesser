# Import from other apps v2 (`feat/import-v2`)

Goal (Sven): sharpen, extend, improve and beautify the move from other apps. Builds on [import-apps.md](import-apps.md). Formats only from public docs; all fixtures invented.

## Phase 1 – inventory (develop @ 73bb979)

Accuracy: **sure** = content signature (≥ 0.9), **likely** = names/columns (0.6–0.9), **guess** = only extension, **–** = not recognised.

| Source | Today | Recognition | Target | Gaps |
|---|---|---|---|---|
| Google Calendar | `.ics` (Takeout `Calendar/`) | sure | calendar | – |
| Google Contacts | people file importer reads `.vcf`, but no source in the detection | – | people | not offered by "Aus anderer App"; contacts without birthday silently dropped |
| Google Keep | Takeout JSON | sure | notes | – |
| Google Tasks | Takeout JSON | sure | todos | – |
| Todoist | CSV per project | sure | todos | ZIP of projects = one wizard per project; repeats only as a note; `DURATION` ignored |
| Obsidian / Markdown | `.md`, ZIP | sure with `.obsidian/`, else guess | notes | – |
| Notion | Markdown & CSV ZIP | sure | notes | CSV databases counted, not read |
| Bank CSV: Sparkasse, ING, DKB, N26, comdirect | CSV, CAMT, MT940, OFX, QIF; presets + column mapping | likely | finance | – (column mapping exists) |
| Bitwarden / 1Password / KeePass | CSV → vault's own import | sure | accounts (route) | KeePass XML, 1Password `.1pux` not read |
| Apple | Calendar `.ics` (as calendar), Contacts `.vcf` (people, see Google Contacts) | sure / – | calendar, people | Notes/Reminders have no file export |
| Microsoft To Do | Outlook CSV | sure | todos | To Do has no own export |
| TickTick | – | – | – | backup CSV (with metadata lines before the header) not read |
| YNAB | – | – | – | register CSV would need an Outflow/Inflow preset |
| Browser bookmarks | bookmarks file importer reads Netscape HTML, but no source in the detection | – | bookmarks | not offered by "Aus anderer App" |
| Evernote, OPML | `.enex`, `.opml` | sure | notes, feeds | – |

Flow gaps (all sources):
- Two entry rows in Settings → Sync & Backup ("Umzug …" = origin tiles that open a module wizard where the file is picked **again**; "Aus anderer App importieren" = file-first detection). Two mental models for one job.
- Detection shows only the app name, no reason, no counts, no confidence.
- The preview says what is skipped and why only **after** the import (report).
- A multi-part run (Takeout) has one batch per module; undo is per part, never per run; past runs can only be undone from inside each module's wizard.
- Encodings: UTF-8 or Windows-1252 fallback; UTF-16 (Excel "Unicode text") unreadable; BOM left in the text (parsers strip it one by one).

## Proposal (built in this branch, no data-format change)

1. **One sheet** ("Umzug von einer anderen App"): *Woher kommst du?* (text + icon tiles, no brand logos, plus "Weiß nicht") → files/ZIP → *Erkannt* with reason, confidence and counts ("Todoist-Export · 3 Projekte · 214 Aufgaben") → the existing preview per module → done → **"Ganzen Umzug rückgängig"** (all batches of the run, `groupId`). Settings shows one card with the last runs and an undo per run. The origin tiles keep feeding `migrate.state` (setup checklist).
2. **Recognition:** `SourceDef.summarize` (counts) + a reason text per source; confidence label; preview head with counts (new / already there / not readable) and the skip reasons before the import; BOM stripped and UTF-16 decoded at unpack time.
3. **Repeats/durations:** Todoist `DATE` "every …"/"jeden …" → `recurrence` (daily/weekly/weekday/monthly/yearly, interval); `DURATION`/`DURATION_UNIT` → `estimateMin`. TickTick `Repeat` (RRULE) → `recurrence`, start–due time span → `estimateMin`.
4. **Three new sources** (why: most common for German private users moving in, and each lands in a module that already has an importer, so the risk stays in a parser):
   - **TickTick** backup CSV → todos (the most-used to-do app without support; lists, subtasks, repeats, durations).
   - **Contacts (vCard)** – Google Contacts, Apple, Outlook → people (every phone has this export; Takeout ZIPs carry `Contacts/*.vcf`).
   - **Browser bookmarks** (Chrome, Firefox, Edge, Safari, Brave HTML export) → bookmarks.
   Not now: YNAB (needs a bank preset; small own PR), KeePass XML / `.1pux` (vault path, own security review).
5. Todoist ZIP: the todos file importer takes several files, one list per project (`@source`) preset by the sheet.

Vault imports stay on the vault's route (master password, `accounts/csv.ts`); nothing of it is read by the sheet beyond the CSV header.
