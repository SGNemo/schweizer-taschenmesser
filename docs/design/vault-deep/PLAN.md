# Unterlagen: own categories – plan

Round "Tiefe & Politur" (2026-11). Ask: categories can be made and deleted.

- **Before:** `document.category` is a fixed enum of seven keys (`identity` … `other` "Sonstiges"); the filter is a `Segmented` with the non-empty ones.
- **Goal:** categories as data: add, rename, colour and icon (palette `categoryColor`, icons from `@/ui/icons`), order, delete. Deleting never loses a document (move to "Ohne Kategorie" or a chosen one, one "Rückgängig"); "Ohne Kategorie" stays. Folder tabs (`FolderTabs`) with counts; search finds a folder's documents by its name; sync-safe; seed; migration (`manifest.version` 4).
- **Package:** one (`feat/vault-docs-categories`). Data model, logic and UI only make sense together (a model without UI changes nothing a user sees; a UI without the model has nothing to edit), and the whole fits one review (~1000 lines incl. tests).

## Model (decision)
- New collection `vault_category` (`name?`, `tone`, `icon`, `order`, `removed?`). Built-in keys are the ids: no record until changed, so two devices never create two "Verträge" and the migration writes nothing.
- `document.category` stays (now any id). A document whose category is gone or unknown is shown, counted and edited under "Ohne Kategorie" (`categoryOfDoc`) – also when another device deleted the folder meanwhile.
- Delete = move the documents first, then `removed: true` (no tombstone: a built-in must not return when tombstones are cleaned up). Undo restores both.
- `other` is "Ohne Kategorie": fixed, never written, last.
- The assistant keeps the built-in enum; folder names never reach it (`aiSchema` unchanged). `accounts` rules untouched.
