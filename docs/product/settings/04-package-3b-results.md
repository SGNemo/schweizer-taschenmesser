# Settings v2 – package 3b (more control)

Branch `feat/settings-control`, 2026-11-03. Screenshots: [PR #408](https://github.com/SGNemo/schweizer-taschenmesser/pull/408) (Seeds `medium`, Dev-Preview; 1920 and 412 px, light and dark).

| Item | Before | After |
|---|---|---|
| Who may alert you | all modules everywhere | per module two switches: bell list in the app, notice at the due time (system or card); only ever a switch-off, own reminders stay visible in the module |
| What the app holds | invisible | Settings → Allgemein → Speicher: usage and whether the browser keeps the data, entries per module, attachments, runtime cache with a confirmed "leeren" (cache only) |
| Accessibility | spread over Appearance and Focus | own category: text size, motion and reading aid in one place (same store as in Appearance), plus Lesehilfe and Fokus (moved here; old links follow) |
| Shortcuts | assignable F-keys only | the shell's own shortcuts listed as fixed; a global hotkey may not take them (Strg+K, Alt+L …); "Alle Kürzel auf Standard" |

Not done: making the fixed shortcuts editable (their handlers sit in `AppShell`/`useShortcuts`); a size per module (Dexie has no per-table byte figure; entries are counted instead); module pages for per-channel switches inside the module (the table is in Benachrichtigungen).
Safety: the pipeline change is one filter on the sources in `collectDue` (`policy.ts` untouched); the cache action deletes only `nemo-lazy-v1`; the vault is not counted in the storage page; nothing from the vault enters the alerts table (module list = modules with notification sources).
New persisted value: `notifyChannels` in the synced `focus` scope (additive, default `{}`).
