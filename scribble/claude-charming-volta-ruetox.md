# for the next chat: mobile header (task 04)

- Topbar fold: `layout/useTopbarCollapse.ts` listens to `scroll` (capture) on the document; on a phone the window scrolls, `#main` only from 900 px (never folds there). Decision: `core/shell/topbarCollapse.ts` (pure, tested).
- Duration is `--dur-fast` (120 ms), not 150 ms: existing token, goes to 0 with less motion.
- Not done: moving "Erweitert" into a menu on calendar/finance/invoices/subscriptions/pantry/people (no "⋯" menu there). `usePageChrome({ advancedInMenu: true })` hides the header switch once a page offers it in its own menu.
- `first-row.spec.ts` picks the first `li`; finance's is far down, use the title bottom as the number.
