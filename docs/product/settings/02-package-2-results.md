# Settings v2 – package 2 (clarity)

Branch `feat/settings-clarity`, 2026-11-03. Screens (Seeds `medium`, Dev-Preview, 1920×1080 and 412×915): Screenshots: [PR #399](https://github.com/SGNemo/schweizer-taschenmesser/pull/399); "before" = the package 1 screens in `screens/after/`.

| Item | Before (package 1) | After |
|---|---|---|
| Erweitert | none | one fold per category for rarely needed sections (KI: local model, statistics; Über: model licences), remembered per category on this device, default "Alle Module Erweitert", opened by links/search/TOC |
| Where values live | not shown | text line above each section: only this device / synced / partly |
| Differs from default | reset button always visible on four sections | badge + button only while something differs; module fields "Geändert · Auf Standard" and "Alle Einstellungen des Moduls auf Standard", undo everywhere |
| Explanation | 32 module fields without a sentence | all fields explained (`strings.settingsHelp.ts`, five languages; test fails for a new field without one) |
| Preview | none | look (inside the open "Farbschema"/"Text" groups), reminder card (top/bottom right, only while the card is on) |
| Security | no hint | calm note for vault auto-lock 30 min and 30 s background delay |

Not changed: keys, defaults, vault, auto-lock logic, update channel, local API (`inventory.test.ts`: one additive device-local key `tm-settings-adv`). Not done (decision needed or later package): live previews for reading aid and widget style, notes for further security-relevant fields (they need the owners' wording), Erweitert for module pages beyond the existing block.
Checks: stimulus budget unchanged (previews only inside open groups, scope line is text only).
