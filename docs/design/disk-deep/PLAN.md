# Dieser PC – deep round "Tiefe & Politur" (plan)

Branch family `feat/disk-optimize-p1…p4`, one PR per package against `develop`, stacked in order (p2 starts from p1 and so on); each package is mergeable on its own once its predecessor is in. Boundary with the "Gerätestatus" chat: **this module acts and optimises**, Gerätestatus shows and explains.

## Ist (2026-11-15)
Tabs Laufwerke + System; scan with treemap, filters (old, kind, empty folders), duplicates, Steam games; deleting only via node ids → Rust plan → block list (`guard.rs`) → recycle bin by default, second confirmation for large/permanent. Quick overview shows known clean-up places and the recycle-bin size, but cleaning them means starting a scan by hand.

## Ziel
"Ich kann meinen PC hier pflegen": clean up with one guided list, see and switch autostart programs, a small catalogue of documented, reversible Windows settings, and health hints – every change in a history with "Rückgängig", nothing runs by itself, Windows only (other systems get an honest "nur Windows").

## Pakete
1. **p1 Aufräumen + Fundament** – tab "Aufräumen": categories (temp files, browser caches, crash reports, old downloads) as suggestions with size and preview list; deleting through the existing `DeleteDialog` (plan → block list → recycle bin). Windows-update leftovers and emptying the recycle bin stay with Windows (buttons open Windows' own tools). Duplicates and large old files lead into the scan. Tab "Verlauf". New crate `crates/pc-tune`: journal (history + undo values), registry seam (`Registry` trait: writes only below HKCU, in-memory fake for tests, real implementation tested on the Windows CI job), allow-listed Windows tools. Platform: `disk.optimize` (one-time line in `core/platform/web.ts`).
2. **p2 Autostart** – tab "Autostart": user Run key, startup folder and the user's own scheduled logon tasks; switch on/off the way Task Manager does (`StartupApproved`), machine-wide entries read-only with a link to Windows settings. No services. Start-time impact: only what Windows reports, no guesses.
3. **p3 Einstellungen (Tweaks)** – catalogue of documented, per-user, fully reversible settings (power plan, animations, transparency, file extensions, hidden files, game mode, advertising ID, tailored experiences, tips). Each: what it does, Microsoft source, risk, current value, set, undo value in the journal, "Alle zurücksetzen". No admin, no value without a Microsoft doc.
4. **p4 Gesundheit** – no tab and no list of recommendations: the next step sits where the state is said. The almost full system drive's card offers the tidy tab; a built-in SSD shows its TRIM state under "Details" (read only); a block above the cards appears only when a drive reports problems. Defragmentation and restore points stay with Windows' own tools.

## Tabs (stimulus budget)
Laufwerke · Aufräumen · Autostart · Einstellungen · Verlauf. "System" stays until the maintainer decides whether it gives way to "Gerätestatus" (question in the p1 PR).

## Verification without a Windows machine
OS access sits behind small traits with in-memory fakes, so rules, undo and "reset all" are unit-tested on Linux; the real registry implementation has round-trip tests under a throw-away HKCU key that the Windows CI job runs; `cargo check --target x86_64-pc-windows-msvc` locally. What only a real PC can show goes into MANUAL-TESTS with an id.

## Reihenfolge und Regeln
p1 first (foundation), then p2 and p3 in parallel worktrees (stacked p1 → p2 → p3 → p4 for the PRs). Each new command in `build.rs` `COMMANDS` + `capabilities/desktop.json`; admin only per action through Windows' own UAC, never kept; nothing runs on a schedule; one undo mechanism for every change (journal); history entries are device-local (app data folder, never synced, no file paths).
