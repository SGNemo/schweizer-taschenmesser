for the next chat: identity v3 foundation is built (PR #414, branch `feat/identity-v3-foundation`). Rules and the table of every module: `docs/design/MODULE-IDENTITY.md`.

## What every module gets from the shell now (nothing to do)
- Full-bleed head band by `identity.head` (nine variants, tall or compact), the area's pattern, icon plate, sub-navigation under the head, centred page, toolbars that wrap, thin scrollbars.
- Widgets: tinted head zone, tinted plate and the area pattern by `identity.widget` (`data-widget`); the default order spreads neighbours of different modules with the same shape.
- No coloured edge stripe anywhere. `ui/noStripes.test.ts` fails on a coloured `border-left`/`inline-start` or a thin bar pseudo-element; use plate, tint, hairline all around, or a filled chip.

## What module chats still do (content, not frame)
- Every manifest has the v3 fields, but the module pages were **not** rebuilt. Per module: fill the head variant's content through `HeroSlot` (`figure`/`extra`/`backdrop`), e.g. `kennzahl` = headline figure + context line, `zeit` = day number + hour strip, `fortschritt` = rings, `regal` = count + tiles. Signatures without a component render nothing yet (`SIGNATURES` in `core/modules/types.ts`).
- Widget bodies should match their `identity.widget` variant (table in MODULE-IDENTITY): the frame is there, the shape inside is the module's.
- A new module: `npm run gen:module` writes the v3 template. `npm run check:modules` fails on a missing field, two hues in an area closer than 25° and neighbours with the same head variant, so pick them against the table.
- `identityFacts` (`scripts/lib/checkIdentity.ts`) reads the manifest text: keep `identity: { … }` a flat object literal (no nested braces) and `area:`/`order:` at two-space indent.

## Leftovers (state 2026-11-04, after #414 and #430 are merged)
- `modules/mail/routes/MailPage.tsx` (`useMediaQuery('(min-width: 1200px)')`), `modules/music/routes/music.module.css` and `modules/weather/routes/weather.module.css` (`@media (min-width: 1200px)`) still decide by the **window**. Since #414 the shared master–detail (`useSplitView`) follows the page container from 56 rem, and the sidebar or the rail change how much room a page has. When you rebuild these pages: hook = `useSplitView()` (or `usePageWidthAtLeast(rem)` from `ui/pageWidth.ts`), CSS = `@container page (min-width: 56rem)` (`PageContainer` is the size container `page`). The same 56 rem keeps 1280 px laptops on the panel layout. Left to the chats that own those pages (mail/music: `feat/identity-v3-haushalt-wissen` package 3, weather: `feat/identity-v3-planen-geld`).
- `layout/AppShell.tsx` keeps its 1200 px **window** query on purpose: it chooses the sidebar width itself, so it cannot depend on the page container (that would be circular).
- Only the sidebar list uses the custom `ui/OverlayScroll`; other scroll areas keep native scrollbars made thin and transparent until hover or scroll.
- Bundle budget: re-baselined in #430 (critical 653 KB gzip, 80 requests, 486 precache files).
