# feat/demo-b – Erstkontakt-Runde, Person B (Bürokaufmann, Excel, Sparkasse)

Report: `docs/qa/round-5/b/` (PERSONA, FINDINGS, FOLLOWUP, MESSAGE, shots, invented Sparkasse CSVs).

- New widget `finance:month` („Diesen Monat“); `home/layout.ts` `CALM_STAND_IN`: shows in the calm view only when the Heute card (`todos:next`) is missing. Specs that list the home widget order now include it (`e2e/core.spec.ts`).
- The bank importer runs `ensureDefaults()` in `optionChoices`, so an import before the finance page was ever opened has the default „Girokonto“.
- `finance/categoryHints.ts` `keywordCategory`: whole-word table for well-known payees → default category ids; only a fallback after the payee's own history. Extend the table there, not in the importer.
- `bookingsCsv(…, { decimal, bom })`: the app passes the region's decimal mark and a BOM.
- `logic.ts` `openingForBalance`: account editor field „Kontostand heute laut Bank“.
- Open for others: B05/B08 (migrate tiles) on the board für demo-a; B09 print view and B10 skipped rows in FOLLOWUP.md. `npm run gen:modules` on develop changes README/modules tables (planner preview → optional) – drift from another PR, left alone.
- `e2e/money-invoices.spec.ts:31` flaked ~1/6: it left the page before the async part-payment booking; now waits on IndexedDB.
