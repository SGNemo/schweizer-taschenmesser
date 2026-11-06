# feat/identity-v3-polish – for the next chat (identity v3.1 package 4, PR open)

- Widget head mark (N05): `home/Home.tsx` draws `SignatureMark` of `identity.signature` at the right end of every widget head, test id `signature-mark` (not `widget-…`: `[data-testid^="widget-"]` selects widgets in specs and audit scripts). A module with `signature: 'none'` gets none. Do not add a second mark inside a widget body (mail/chat dropped theirs; `NotizBody mark` is now unused).
- Overdue text (N08): `dueState` label is „war am Di. fällig“ / „war am 17. Sep. fällig“ (`t.time.overdueOn`, `pastDay()` in `core/time/due.ts`). Never a day count. Open: the pantry **page** still says „Seit n Tagen abgelaufen“ (`t.pantry.expired`, `PantryPage.tsx`) – same rule, not in this package.
- Sidebar (F06): areas folded except the current page's; hand choices in `tm-nav-open` / `tm-nav-closed` win. e2e that clicks a sidebar link of another area: `openNavArea(page, 'Wissen')` from `e2e/helpers.ts`.
- `check:modules` now fails on raw `font-weight` numbers (`checkFontWeights`); use `var(--weight-*)` or `normal`.
- Signature id `hourStrip` is gone (`stopwatch` for timetrack); the calendar's `HourStrip` block stays.
- `e2e/screenshots/clipped-text.spec.ts` groups by region (widget/head/row/page) at 360 and 1920; first run: desktop rows 39 (calendar chips, lists) – not judged yet.
