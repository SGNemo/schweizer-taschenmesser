# Listen – Tiefe & Politur (round 2026-11)

Maintainer ask: „Listen auch löschbar und erstellbar machen.“

## Ist (develop, 2026-11-15)
- Lists can be created and edited (name, kind, note, trip) and deleted with undo – except the fixed shopping list `shopping-default`, which can never be deleted.
- No icon or colour, no way to reorder or archive; the tab row grows with every list.
- "Zuletzt gelöscht" lists a deleted list but brings it back without its entries.
- Entries cannot change lists; templates are routines and packing lists only (no weekly shop).
- The widget always shows `shopping-default`; the share sheet does not offer lists; the pantry can push to the shopping list, the list cannot pull.

## Ziel
Every list is an ordinary list: create (name, icon, colour, kind) · rename · reorder · archive · delete (undo + 30-day trash with entries). Entries move between lists. Templates start a list. Widget shows the list you choose. Shared text lands on a list. A shopping list fills itself from the pantry (running low / expiring).

## Pakete (one branch + PR each, in order, each mergeable alone)
1. `feat/lists-manage-p1` – schema v3 (`icon`, `tone`, `archived`), list editor with icon/colour, "Listen verwalten" (order, archive, restore, delete), the fixed shopping list becomes an ordinary list (incoming items go to the first shopping list), trash restores entries.
2. `feat/lists-manage-p2` – move entries between lists; templates "Wocheneinkauf" and "Urlaub" as a start in the new-list dialog.
3. `feat/lists-manage-p3` – widget shows the chosen list; share target "Auf eine Liste".
4. `feat/lists-manage-p4` – "Aus Vorräten auffüllen" (new event pair with the pantry: low stock and expiring items).

Routine templates (Morgen/Abend/Woche) stay untouched: they belong to the „routinen“ chat (scribble `rounds/2026-11-tiefe/listen.md`).
