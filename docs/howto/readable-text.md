# Show text readably

Rules: [DESIGN-SPEC §4b/§4c](../design/DESIGN-SPEC.md). Settings: Darstellung → Lesen (device-local, `stores/ui.ts`).

- **Running text** (help, answers, descriptions): `<ReadableText text={s} />` from `@/ui` inside your `<p>`; wrap multi-paragraph text in `<Prose>` (68 ch, paragraph spacing). A long note or answer can offer `<ReaderView open onClose title text />` (Fokus-Lesen, aid forced on).
- **List rows:** pass strings to `ItemRow` `title`/`meta`; they get `kind="list"` automatically (aid only with scope "auch Listen"; short facts in `meta` stay plain, sentences with ≥ 5 words are treated as teasers).
- **Never** use it for inputs, numbers, code, buttons, navigation, vault/accounts. `ui/ReadableText.test.tsx` fails if `modules/vault`, `modules/accounts`, `Fields` or `Button` import it.
- **Groups:** `groupByTime(items, dateOf, today, { doneOf })` / `groupByStatus` from `core/time/groups.ts`, rendered with `<GroupedList listId groups />` (each group: `id`, `label`, `count`, `tone?`, `children` = an `ItemList`). Use `ItemRow tone="overdue|today"` for the urgency stripe and `StateBadge` for the word.
- **Colour:** pick a meaning from `ui/semantics.ts`; categories via `categoryColor(index)` with the name next to the dot; navigation areas get `data-area`. No hex, no new accent text.
- **Checks:** `npx vitest run src/core/text src/core/time src/ui`, `npx playwright test e2e/readability.spec.ts`.
