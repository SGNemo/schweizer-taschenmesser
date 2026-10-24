# feat/focus2-bookmarks – for the next chat:
- Merkliste list is calm now (see `docs/product/focus/12-results-2.md`). The Lesezeichen tile view (`?view=links`) still has button + edit icon per tile: same pattern (`ItemRow href` + "⋯") would fit, its e2e (`links.spec.ts`, `lists.spec.ts`) asserts buttons today.
- Gotcha: a row menu on a non-last row was painted under the next row (enter animation = own layer); fixed in `ui/Patterns.module.css` (`.item:has(.actionsOpen)`). Swipeable rows (`overflow: hidden`) may still clip a menu: untested.
- `openBookmarksMenu` in `e2e/helpers.ts` is an alias of `openTodosMenu` (same "Weitere Optionen" menu name).
- Not done: "Mit KI eintragen" stays in the area header (no `usePageChrome({ writeInMenu })` on this page).
