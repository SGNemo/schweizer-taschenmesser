# feat/identity-v3-wissen – for the next chat

Package 2 of 3 (notes, bookmarks, feeds, chat, browser). Package 3 (mail, music, downloads) follows on its own branch.

## Proposals for whoever owns `ui/*` (not touched here)
- (DONE in `feat/ui-empty-motif`: `EmptyState` takes `motif` and `testId`, the module wrappers are thin.) `EmptyState` `motif?: ReactNode` (now five more module-local copies: Notes/Bookmarks/Feeds/Chat/Browser plus the four of package 1).
- `SignatureId` `masthead` for the feeds head (feeds keeps `signature: 'none'` and draws the masthead with `HeroFigure` type `serif` and `identity.type: 'serif'`).
- Index-tab and folder-tab shapes are now copied in notes, vault and accounts: one shared `Tabs`-style "folder tab" strip would remove the copies.

## Notes
- Feeds has no articles (the app does not fetch feeds); the "lead" is the newest source, not a headline. A real reader would replace it.
- `identity-v3.spec.ts` now also tours `/feeds`.
