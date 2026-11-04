# feat/identity-v3-haushalt-wissen – for the next chat

Package 1 of 3 (pantry, lists, vault, accounts). Packages 2 (notes, bookmarks, feeds, chat, browser) and 3 (mail, music, downloads) follow on their own branches.

## Proposals for whoever owns `ui/*` (I did not touch it)
- `EmptyState` always draws the Nemo fish. Four module-local empties exist (`PantryEmpty`, `ListsEmpty`, `VaultEmpty`, `AccountsEmpty`): an optional `motif?: ReactNode` prop would remove the copies.
- `TileGrid` has no count/state line; the pantry widget draws its own tiles (see decisions/ui-shell.md).
- `HeroFigure` `label` is user text for the shopping list name: a very long unbroken list name cannot be wrapped from a module (needs `overflow-wrap` in `HeroFigure.module.css`).
- `HeroSlot area="figure"` on a phone pushes `extra` below the figure, so heads with tiles grow to about 14 rem; fine, but the phone stimulus budget of pantry rose by 20 %.

## Notes
- `mail.link.test.tsx` ("a note takes the start of the mail only when asked") failed once in a full `npm test` run under load and passes alone, also on `develop`: flaky, not mine.
- The screenshot spec captures a grid page while the list-enter animation runs: the third card can look missing; wait longer (`SCREENS_WAIT`) if it matters.
- `e2e/screenshots/grid.mjs` lays before/after screenshots side by side; `SCREENS_DIR` must not be inside `test-results/` (Playwright wipes it at the start of every e2e run).
