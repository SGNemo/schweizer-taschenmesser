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

## Leftovers I did not touch (module or other areas)
- `modules/mail/routes/MailPage.tsx`, `modules/music/routes/music.module.css`, `modules/weather/routes/weather.module.css` and `layout/AppShell.tsx` still decide by the 1200 px **window** (`useMediaQuery` / `@media`). Shared master–detail (`useSplitView`) follows the page container from 56 rem now; those four could move to `usePageWidthAtLeast` (`ui/pageWidth.ts`).
- Only the sidebar list uses the custom `ui/OverlayScroll`; other scroll areas keep native scrollbars made thin and transparent until hover or scroll.
- The bundle baseline (`scripts/bundle-budget.json`) was raised for the new shell components, see the PR text.
