# Decisions in full – Phone with one hand (2026-10-24)

One-line summary: [DECISIONS](../DECISIONS.md) → UI section. Split from [focus.md](focus.md) (budget). Results: [12-results-2.md](../product/focus/12-results-2.md) → "Mobile".

- **Phone with one hand (`feat/phone-one-hand`):** decided without asking, calm variant, no new element, no new route.
  - **Back closes what is open first.** `core/shell/backStack.ts` keeps one `history.pushState` marker per open `Dialog`/`RowMenu` (by id, never twice). A button close removes the marker again (`history.back()` only when ours is on top); a marker left behind by a route change is stepped over. A dialog with a draft asks first, a second Back at the question means "keep editing" (Back never discards by itself). Rejected: a Back stack inside the router (`AppShell`/`router.tsx` stay untouched).
  - **Keyboard.** The page already resizes with it (`interactive-widget=resizes-content`); `visualViewport` is only the fallback: `--kb-inset` lifts bottom sheets, a focused `data-keep-visible` add field is scrolled into view (no animation). ToDo and capture fields keep the focus after saving.
  - **Thumb zone.** The footer of a phone sheet is sticky at the bottom edge (main action bottom right); a row menu opens upwards when there is no room below it (above the bottom bar).
  - **Measured.** Ten paths in `e2e/phone-paths.spec.ts`: no path has more steps than before; stimulus inventory and touch-target gaps unchanged (0).
