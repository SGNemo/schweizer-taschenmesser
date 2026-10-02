# Add a setting

Settings live on `/settings/<category>`. The page, the search, the palette ("Einstellung: …") and deep links are generated from the **settings registry** (`web/src/core/settings/registry/`); a section without a valid category fails `registry` tests and `npm run check:modules`. Never append UI to the page by hand.

## Categories (route ids)
`allgemein` · `darstellung` · `module` · `werkzeuge` · `benachrichtigungen` · `sicherheit` · `sync` · `ki` · `verbindungen` · `schnellerfassung` · `updates` · `entwickler` (Dev-Preview only) · `ueber`. Titles and texts: `t.settings.cat` in `strings.ts`. A new category = add the id to `SETTINGS_CATEGORY_IDS` (`registry/types.ts`), icon in `categories.ts`, texts in `strings.ts`, an entry in `e2e/a11y.spec.ts`, a line in DECISIONS.

## A module setting (usual case)
1. Add the field to `modules/<id>/settings.ts` (`schema`, `defaults`, `fields`: `boolean` → switch, `select` ≤ 4 short options → segmented, else select, `number`/`text` → input saved on blur). Keys and defaults never change silently: `pages/settings/inventory.test.ts` pins them (a deliberate change needs a migration and `npx vitest run -u pages/settings/inventory.test.ts`).
2. It appears under **Module → <module name>**. Another category: `category: 'sicherheit'` (accounts does), plus optional `order` and German `keywords` for the search.
3. Texts (label, `help`) come from `strings.ts`; `help` is the one-line description in the row.

## A section of your own (core feature, tool, connector UI)
1. Component with `SettingsGroup` (title, optional `hint`) and `SettingRow` rows (label, description, control on the right; controls get `labelHidden` because the row shows the text). Destructive actions go into `DangerZone`; irreversible ones use `TypedConfirmDialog`.
2. Register it in `pages/settings/sections.tsx` (`CORE_SECTIONS`): `id` (deep-link anchor, unique), `category`, `order`, `title`, `description`, `keywords`, `fields` (labels the search and palette can jump to; row ids are `<section>--<field>`), `visibleWhen(ctx)` (`ctx.platform`, `ctx.isDev`, `ctx.isModuleEnabled(id)`), `render`.
3. Dev-only UI must be lazy and behind `layout/devTools.ts` (the stable build must not contain it, `core/seed/devFlag.test.ts`); do not import `strings.dev.ts` in `sections.tsx`.
4. Link to it with `settingsPath(category, sectionId, fieldKey?)` (`registry/paths.ts`), never a literal URL.

## Checks
`npx vitest run src/core/settings src/pages/settings`, `npm run check:modules`, `npx playwright test e2e/settings.spec.ts e2e/a11y.spec.ts -g settings`. Secrets (keys, tokens) stay in `getPlatform().secrets`; never show them in clear text.
