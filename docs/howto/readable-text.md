# Show text readably

Rules: [DESIGN-SPEC §4b/§4c](../design/DESIGN-SPEC.md). Settings: Darstellung → Lesen (device-local, `stores/ui.ts`).

- **Text:** nothing to do. The app's JSX runtime (`core/text/readjsx`, set as `jsxImportSource` in `tsconfig.app.json`, `vite.config.ts`, `vitest.config.ts`) wraps string children of ordinary elements into `ReadableText`; the level comes from the element (`p` 25 · headings/`li` 50 · others 75 · `button`/`a` 100). Plain strings passed through third-party components are not seen: use `<ReadableText text level />` there (React Router `Link`/`NavLink` are handled).
- **Not wanted somewhere** (secrets, generated codes): render it in `<code>`/`<input>`, or wrap the subtree in `<NoReadAid>` (the vault routes are wrapped in `router.tsx`).
- **Long text:** wrap paragraphs in `<Prose>` (68 ch, paragraph spacing); a long note or answer can offer `<ReaderView open onClose title text />` (Fokus-Lesen, aid forced on).
- **List rows:** `ItemRow` gives titles `tone="ink"` (dimmed rest when the title is in primary ink) and sentence-like `meta` the aid at level 50.
- **Groups:** `groupByTime(items, dateOf, today, { doneOf })` / `groupByStatus` from `core/time/groups.ts`, rendered with `<GroupedList listId groups />` (each group: `id`, `label`, `count`, `tone?`, `children` = an `ItemList`). `ItemRow tone="overdue|today"` is the urgency stripe, `StateBadge` the word.
- **Colour:** pick a meaning from `ui/semantics.ts`; categories via `categoryColor(index)` with the name next to the dot; navigation areas get `data-area`. No hex, no new accent text.
- **Checks:** `npx vitest run src/core/text src/core/time src/ui`, `npx playwright test e2e/readability.spec.ts` (includes axe at 100 % on the main pages, light and dark).
