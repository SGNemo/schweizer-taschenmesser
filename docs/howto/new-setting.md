# Add a setting

Settings live on `/settings/<category>`. The page, the search, the palette ("Einstellung: …") and deep links are generated from the **settings registry** (`web/src/core/settings/registry/`); a section without a valid category fails `registry` tests and `npm run check:modules`. Never append UI to the page by hand.

## Categories (route ids)
`allgemein` · `darstellung` · `module` · `werkzeuge` · `benachrichtigungen` · `sicherheit` · `sync` · `ki` · `verbindungen` · `schnellerfassung` · `updates` · `entwickler` (Dev-Preview only) · `ueber`. Titles and texts: `t.settings.cat` in `strings.ts`. A new category = add the id to `SETTINGS_CATEGORY_IDS` (`registry/types.ts`), icon in `categories.ts`, texts in `strings.ts`, an entry in `e2e/a11y.spec.ts`, a line in DECISIONS.

## Where it appears (settings v2)
`/settings` is the **overview** (eight status cards: look, security, sync, AI, notifications, updates, storage, modules; `pages/settings/SettingsOverview.tsx`). A category page has a breadcrumb (wide windows), its **groups** as the second level of the navigation (`registry/groups.ts`: a section names its `group`, core sections are placed in that file) and, from 1440 px, a table of contents on the right. Optional section props: `group`, `level` (`basic`|`advanced`), `scope` (`local`|`synced`|`mixed`).

## Clarity helpers (settings v2, package 2)
- **Erweitert fold:** a category folds its rarely needed sections behind one "Erweitert" line when it also has Basis sections (`levelOf` in `registry/meta.ts`; a section can set `level: 'advanced'` itself). The state is remembered per category on this device (`core/settings/foldState.ts`, `tm-settings-adv`), default = "Alle Module Erweitert". Keep daily things in Basis: help, diagnostics, reset, legal, sync, backup, anything that can be switched on and run. A link, search hit or the TOC opens the fold by itself.
- **Scope line** ("Nur auf diesem Gerät" / "Abgeglichen" / "Teils …"): `scopeOf` in `registry/meta.ts` (table for core sections, module sections are always synced); a section can set `scope` itself. No entry = no label.
- **"Vom Standard abweichend":** a section with `reset: <ResetPlan>` also needs `defaults()` in the plan; the reset row (badge + button) only shows while the values differ (`core/settings/changed.ts`). Module fields get "Geändert · Auf Standard" per field and "Alle Einstellungen des Moduls auf Standard" on the module page, both with an undo toast, from the module's `defaults`.
- **Explanation:** every field needs a one-sentence `help`. If a module wrote none, `strings.settingsHelp.ts` (keyed `<module>.<field>`, five languages) fills in; a test fails for a field with neither.
- **Preview** (`SettingExtras.tsx`: `SettingPreview`, `LookPreview`, `ReminderPreview`): static, nothing is sent or saved; show it inside the open group, not at rest (stimulus budget).
- **Security note:** `core/settings/warnings.ts` maps a field anchor + value to a calm note (`SecurityNote`); it informs, never blocks.

## Profiles, export/import, change history (package 3a)
- **What may be switched or exported:** the allow-list in `core/settings/values.ts` (look and feel from `stores/ui.ts`, a few reminder choices from the synced `focus` scope), one zod schema per key; the same list serves profiles, the history and the file. A new key goes in there with its schema and in the test list of `profiles.test.ts`; nothing security related is ever added (vault, auto-lock, keys, tokens, update channel, disk, local API).
- **Profiles** (`core/settings/profiles.ts`): three built-ins in code, own ones in the synced scope `profiles`; "active" is derived (the profile whose values all match, the last switched-on wins), schedules and the last-run marker are device-local. Switching goes through `applyProfile` (toast with undo, one history entry).
- **Export/import** (`core/settings/transfer.ts`): scopes `core`, `focus`, `comfort`, `profiles`, `module.<id>` and the look; modules of the category Sicherheit, `supporter`, `ai.switch`, secrets and any value that looks like a web address never leave. Import validates every value with the schemas above, previews the changes and can be undone.
- **History** (`core/settings/history.ts`): records through the store subscription and the observer seam in `setSettings(scope, patch, defaults)`. Pass `defaults` where the caller knows them, so the first change of a setting can be taken back. `isRecorded` keeps the vault, supporter, AI switch and secrets out. A write that is a group (profile, import) wraps itself in `withoutHistory` and calls `recordGroup`.

## A module setting (usual case)
1. Add the field to `modules/<id>/settings.ts` (`schema`, `defaults`, `fields`: `boolean` → switch, `select` ≤ 4 short options → segmented, else select, `number`/`text` → input saved on blur). Keys and defaults never change silently: `pages/settings/inventory.test.ts` pins them (a deliberate change needs a migration and `npx vitest run -u pages/settings/inventory.test.ts`).
2. It appears on the module's own page **Module → <module name>** (`/settings/module/<id>`, `ModuleSettingsPage`), in the fixed blocks General · Display · Notifications · Data · Advanced. Place a field with the optional `group: 'display'|'notifications'|'data'|'general'` and `level: 'advanced'` (default: General, basic; `check:modules` rejects unknown values). Start data and "Schema kopieren" always sit in Data. Links: `settingsPath('module', 'module-<id>', fieldKey)` gives the page URL. Another category: `category: 'sicherheit'` (accounts does), plus optional `order` and German `keywords` for the search.
3. Texts (label, `help`) come from `strings.ts`; `help` is the one-line description in the row.

## A section of your own (core feature, tool, connector UI)
1. Component with `SettingsGroup` (title, optional `hint`) and `SettingRow` rows (label, description, control on the right; controls get `labelHidden` because the row shows the text). Destructive actions go into `DangerZone`; irreversible ones use `TypedConfirmDialog`.
2. Register it in `pages/settings/sections.tsx` (`CORE_SECTIONS`): `id` (deep-link anchor, unique), `category`, `order`, `title`, `description`, `keywords`, `fields` (labels the search and palette can jump to; row ids are `<section>--<field>`), `visibleWhen(ctx)` (`ctx.platform`, `ctx.isDev`, `ctx.isModuleEnabled(id)`), `render`.
3. Dev-only UI must be lazy and behind `layout/devTools.ts` (the stable build must not contain it, `core/seed/devFlag.test.ts`); do not import `strings.dev.ts` in `sections.tsx`.
4. Link to it with `settingsPath(category, sectionId, fieldKey?)` (`registry/paths.ts`), never a literal URL.

## Offer a setting with a context link (gear)
Where a setting matters (widget, module header, dialog) show `<SettingsLink to={settingsPath(category, sectionId, fieldKey)} label={…} />` from `@/ui`: one tap, the section opens and is highlighted. Widgets of modules with settings and the module header (`AreaFrame`) get the gear without module code (`moduleSettingsPath(manifest)` in `pages/settings/useSections.ts`). For a link in docs or the palette use the internal schema in `core/deeplink.ts`: `nemo://settings/<category>[/<section>[/<field>]]`, `nemo://library/<module>`, `nemo://tools/<tool>` (`parseAppLink` → route; `/library#module-<id>` and `/tools#tool-<id>` are marked by `useHashTarget`). The schema is internal: no OS registration, ids only.

## Quick switch, reset, search words
- **Quick switch** (palette command per value + the quick bar in Settings): add an entry to the allow-list in `core/settings/quick.ts`. Appearance choices only; anything security related never goes in (tested).
- **Reset** (button under the section, toast with "Rückgängig"): set `reset: <ResetPlan>` on the section in `sections.tsx` (`core/settings/reset.ts`). Opt-in; never for vault, auto-lock, keys, tokens, update channel, disk (tested).
- **Everyday search words** for a section or one setting: `synonyms` in `strings.comfort.ts` (`<section>` or `<section>--<field>`, all five languages; a test rejects ids that do not exist).
- **Frequently used** (top of the settings list) is device-local, switched off by "Verlauf in der Suche", emptied by "Verlauf löschen" (`core/settings/frequent.ts`).

## Checks
`npx vitest run src/core/settings src/pages/settings`, `npm run check:modules`, `npx playwright test e2e/settings.spec.ts e2e/a11y.spec.ts -g settings`. Secrets (keys, tokens) stay in `getPlatform().secrets`; never show them in clear text.
