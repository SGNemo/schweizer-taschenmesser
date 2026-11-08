# Settings v2 – package 3a (manage your settings)

Branch `feat/settings-manage`, 2026-11-03. Screenshots: [PR #403](https://github.com/SGNemo/schweizer-taschenmesser/pull/403) (Seeds `medium`, Dev-Preview; 1920 and 412 px, light and dark).

| Item | Before | After |
|---|---|---|
| Switch many settings | one by one (3–4 clicks each) | profile in the quick bar (one choice), the palette ("Profil: Abends") or Settings; toast with undo |
| Profiles | none | Ruhig, Arbeit, Abends + own (synced); active one derived; schedules (weekdays + time, device-local, only while the app is open) |
| Move settings | none (backup holds data, not preferences) | one JSON file out, in with a preview and one-step undo; no vault, supporter code, secrets, addresses |
| What changed lately | not visible | last 30 changes on this device, each with "Rückgängig"; profile switch / import are one entry; off switch and "Verlauf löschen" |

Safety: one allow-list for all three (`core/settings/values.ts`: look + a few reminder choices, strict schema; vault, auto-lock, keys, tokens, update channel, local API cannot be written by a profile or a file). History skips vault, supporter, AI switch, secrets. Export drops anything that looks like a web address. Tests pin all of it.
New persisted keys (device-local, in the inventory): `tm-profile-schedules`, `tm-profile-last`, `tm-profile-applied`, `tm-settings-history`, `tm-settings-history-on`; new synced scope `profiles` (no migration: a new scope).
Not in 3a: shortcut editor, per-module/channel notifications, storage page, accessibility category (3b); the bundle split after that.
