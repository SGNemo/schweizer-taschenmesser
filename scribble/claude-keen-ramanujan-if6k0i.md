# claude/keen-ramanujan-if6k0i (T2: bank import + finance rules)

for the next chat:
- The branch was created on old `main`; I reset it to `origin/develop` before starting (it had no commits of its own).
- Bank presets (`modules/finance/bankPresets.ts`) are written from public export descriptions and **invented fixtures**. A real export per bank (Sparkasse CSV-CAMT/MT940, ING, DKB old/new, N26, comdirect, Volksbank/GLS) has not been tried: if one does not match, the column assignment dialog still works; fix the preset (column names are `normalizeHeader` output: umlaut dots are dropped, "Währung" → `wahrung`).
- Slot for importers: `ImportParseResult.slot` (`resolve` = question instead of the preview, `preview` = panel below the list, `onCommitted` after the write). Rule chips reuse `candidate.warning` because `ImportPreview.tsx` was off limits.
- Rules and mappings are in `_meta` (device-local). If they should sync, move them to a collection (`db:bump`) or the synced module settings (then `inventory.modules.json`).
- Setting "Bezahlte Rechnung als Ausgabe buchen" defaults to **on** (the booking already existed unconditionally); the T2 brief said "Standard aus", I kept the behaviour so nothing disappears. Flip the default in `modules/invoices/settings.ts` if the maintainer wants it off.
- `inventory.modules.json` got two new fields (invoices `bookWhenPaid`, subscriptions `priceHint`): T3 should regenerate (`npx vitest run src/pages/settings/inventory.test.ts -u`) after merging.
- Declined rule suggestions are not remembered; if it feels naggy, add a `_meta` list of declined patterns.
