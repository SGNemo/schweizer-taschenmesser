# Comfort review – 07 Summary (modules)

Closing note for [01-friction](01-friction.md) → [02-plan](02-plan.md) → [03-results](03-results.md). Hand tests: [MANUAL-TESTS](../../MANUAL-TESTS.md) K1–K4.

| Package | PR | Outcome |
|---|---|---|
| 1a | #149 | every delete has undo (toast / Ctrl+Z); `check:modules` enforces it |
| 1b | #155 | one row-action contract: swipe + ⋯ menu, date quick-shift, pay invoice in one tap, bookings re-categorise from the row, todos on `ItemRow` |
| 3 | #156 | per-module Basis / Erweitert, global "all Erweitert" switch (module choice wins) |
| 2 | #157 | capture invoices and notes, payee autofill, duplicate |
| 4 | #158 | `?open=<id>` deep links, restock all, chat answer → note |
| 5a–c | #159–#161 | booking search/filter, gift overview, subscription price history + "gekündigt zum", recurring invoices |

Rules that came out of it: `howto/list-actions.md`, [advanced-fields](../../howto/advanced-fields.md); focus checklist item 8.
Left on purpose: system modules (other chat), vault documents (bytes cannot be undone), typed confirmation in the disk module (other chat).
