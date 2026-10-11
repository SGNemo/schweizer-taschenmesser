# Launch checklist (manual)

Do this on a **fresh Windows VM** and a **real Android device** before a release goes public. Tick the boxes in a copy of this file or the release issue. Automated parts: `npm run e2e`, `npm run test:update-path` ([howto/bug-reports.md](howto/bug-reports.md)).

## Windows (fresh VM, no dev tools)
- [ ] Download `Nemo-Portable.exe` from the release page, SHA-256 matches the one in the release notes.
- [ ] Start it: SmartScreen warning appears ("Weitere Informationen" → "Trotzdem ausführen"); the app opens, no error screen.
- [ ] Settings → Über Nemo: version and channel are the release's; data folder is shown.
- [ ] Setup assistant runs to the end (also try "Später" on a second fresh start).
- [ ] Create one entry in To-dos, Finanzen, Rechnungen; they show on the home screen.
- [ ] Sync: connect a test server, entries appear on a second device.
- [ ] Backup: download, delete an entry, restore → entry is back.
- [ ] Diagnostics: Über Nemo → Diagnose exportieren shows the file, no entry titles, server address or user name; save works. "Fehler melden" opens the GitHub form with version/platform filled.
- [ ] Safe mode: `Nemo-Portable.exe --safe-mode` shows the banner, all modules off; normal start brings them back.
- [ ] **Update N → N+1:** start release N, create data, then Settings → Updates → install N+1 (or replace the exe). Data and settings are still there, version is N+1, no recovery screen.
- [ ] Uninstall without leftovers: portable → delete exe and the `data` folder next to it; check `%APPDATA%` (pre-update backups) and `%LOCALAPPDATA%\io.github.sgnemo.taschenmesser` are gone or only contain what the docs say. Installed version → "Apps & Features", then same folders.

## Android (real device)
- [ ] Install `Nemo.apk` (unknown-sources prompt), app starts.
- [ ] Setup assistant, one entry per core module, sync with the Windows data.
- [ ] Backup and restore.
- [ ] Diagnostics export saves a `.txt` (share sheet); "Fehler melden" opens the browser.
- [ ] Safe mode: force an error screen (or open `/?safe=1` in the PWA), triple tap on the logo restarts with all modules off.
- [ ] **Update N → N+1:** install N+1 over N (same signature); data stays.
- [ ] Uninstall: app removed; no leftover entry in Settings → Apps; keystore secrets gone with it.

## Sign-off
- [ ] Nothing in the screenshots/logs contains real data.
- [ ] Known problems written into the release notes.
