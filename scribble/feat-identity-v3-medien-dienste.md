# feat/identity-v3-medien-dienste – for the next chat

Package 3 of 3 (mail, music, downloads). With packages 1 and 2 the household, vault, knowledge, media and service pages are rebuilt on identity v3.

## Not done, for whoever picks it up
- Unread mail rows could carry a small envelope mark (module-local, in `ThreadList`).
- (DONE in `feat/ui-empty-motif`: `EmptyState` takes `motif` and `testId`, the module wrappers are thin.) Shared `ui/*` proposals (not touched): `EmptyState` `motif` prop (now twelve module-local copies), one shared folder-tab strip, a `masthead` signature id, a `columns` option for `GroupedList`.
- The `identity-v3.spec.ts` screenshot tour and `e2e/screenshots/grid.mjs` produce the "all modules side by side" sheets; keep `SCREENS_DIR` outside `test-results/`.
