# Decisions – readability (feat/readability, 2026-10-05)

Index: [DECISIONS](../DECISIONS.md). Spec: [DESIGN-SPEC §4b/§4c](../design/DESIGN-SPEC.md).

- **The reading aid is an own small text engine, off by default, device-local.** No library, no service; `Intl.Segmenter` for graphemes. Soft weight (560 + a step of contrast) is the default because it changes widths less than bold; bold is selectable. Verified: the settings preview keeps its height when toggled (e2e).
- **Never in the vault/accounts, inputs, numbers, buttons, navigation** – consistency and secrecy matter more there; a test pins the imports.
- **Colour only with meaning, always with a word or icon.** Six fixed category hues (`--cat-1…6`, ≥ 3:1), reused for the six navigation areas (icon + thin stripe, never text). Calendar blocks are neutral with a kind stripe; deadlines are `--warning`, red stays overdue/exceeded/expense. "Ruhig" mode greys everything but overdue and today.
- **Groups by space + small collapsible heads with counts** (`GroupedList`), time groups default in Rechnungen and ToDos; fold state device-local. Default line spacing 1.5 → 1.6.
- **Fokus-Lesen** is a dialog (`ReaderView`) opened by the user, not a global mode; first user: notes.
