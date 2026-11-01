# Bank statement import and rules (Finances)

Files only: the user exports in online banking and picks the file in Finances → "Kontoauszug importieren". No account, no FinTS, no network, nothing uploaded. Same wizard as every importer: preview first, nothing stored before confirmation, one undoable batch.

## Formats (recognised from the content, not the file name)
| Format | Parser | Notes |
|---|---|---|
| OFX, SGML (1.x) and XML (2.x) | `core/io/ofx.ts` | `STMTTRN`: `DTPOSTED`, `TRNAMT`, `NAME`, `MEMO`, `FITID`; `CURDEF` = currency; XML-OFX is checked **before** CAMT |
| QIF (`!Type:Bank`, `CCard`, …) | `core/io/qif.ts` | `D T/U P M ^`; dates `DD.MM.YYYY`, `MM/DD'YY`, `MM/DD/YYYY` (day first if the file proves it), `YYYY-MM-DD`; no currency in the file |
| CAMT.052/.053 XML | `parseCamt` in `core/io/bank.ts` | unchanged |
| Bank CSV | `parseBankCsvWith` + a `BankCsvLayout` | header row is searched (account info above it is fine); delimiter `;` `,` tab tried |

Encoding: `ImporterMeta.legacyEncoding` makes the wizard read bytes (`pickTextFile(accept, { legacyEncoding: true })` → `decodeTextBytes`): UTF-8 first, Windows-1252 only when UTF-8 shows replacement characters.

## Where to get the export
- **Sparkasse:** Umsätze → Export → "CSV-CAMT" or "CSV-MT940"; also CAMT.
- **ING:** Umsatzanzeige → Download → CSV. **DKB:** Umsatzliste → Export CSV (old and new layout). **N26:** Konto → Export (CSV). **comdirect:** Umsätze → Download CSV. **Volksbank / GLS:** Umsatzanzeige → Export CSV.
- Any bank that offers **OFX** or **QIF** (also "Money/Quicken" exports) works without a preset.

## Bank presets
`modules/finance/bankPresets.ts` is data only (name, delimiter, encoding, normalized column names for date/amount/payee/purpose/balance, header signature). Presets: Sparkasse (CSV-CAMT, MT940-CSV), ING, DKB (old, new), N26 (English, German), comdirect, Volksbank/GLS. Detection is by header; the preview says "Erkannt: DKB". Column names come from the banks' public export descriptions and **invented fixtures** (`core/io/__fixtures__/bank/`, 3 rows each): real exports differ by year, so a hand test with a real file per bank is open (STATUS). DKB (new) uses the other party as payee and leaves "Vorgemerkt" rows out; comdirect splits "Auftraggeber: … Buchungstext: … Ref. …".

## Unknown CSV: column assignment
No preset and no usual column names → the wizard shows `ColumnMapping` (slot `ImportParseResult.slot`, placement `resolve`): date / amount / payee / purpose with the first 3 rows, best guess preselected. The answer is stored in `_meta` `finance.bankMappings` (device-local, by header signature `bankHeaderSignature`) and applied silently next time ("Erkannt: deine gemerkte Spaltenzuordnung"). A wrong assignment that reads nothing is not kept.

## Duplicates
`bankDedupeKey` (date + amount + payee + purpose, plus `#n` for repeats) stays the key across imports; FITID only removes a booking listed twice **inside one file** (it is not stored). Test: the same file twice = 0 new bookings.

## Currency
OFX `CURDEF` / the CSV currency column / the preset decide the file's currency; bookings go only to an account of the same currency, the rest is skipped with one calm note (no conversion). QIF has no currency and goes to any account.

## Rules (suggestions, never silent)
`modules/finance/rules.ts` (pure) + `rulesStore.ts` (`_meta` `finance.rules`, device-local). A rule = normalized payee pattern → category and optionally a subscription (`sourceRef: subscription:<id>`). After parsing, the preview shows one line per new payee that has something to propose (slot placement `preview`, nothing ticked, max 5): a subscription of the user whose name is in the payee, a provider from the shipped subscription suggestions (same list as the form), or a category earlier bookings of that payee shared at least twice. Ticking shows the effect on the rows at once; the rule is created only when the import is confirmed. Rules apply to later imports (chip "Regel: …"), are listed (folded) under Finances → Categories and can be removed there; removing never changes bookings.

## Paid invoice → booking, price rise
- Setting "Bezahlte Rechnung als Ausgabe buchen" (Rechnungen, default **on** = the behaviour since the module exists). Only while Finances is on; skipped when a repeating booking with the same payee and amount exists; the booking id derives from the invoice, so paying twice books once.
- "Preis erhöht": `subscriptions/attention.ts` → one calm notice (accent, not red) under "Jetzt wichtig" for a rise of the last 30 days, from the day the app first sees it for 3 days, never again (`_meta` `subscriptions.priceHints`); setting "Hinweis bei Preiserhöhung" turns it off.
