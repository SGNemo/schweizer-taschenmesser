# feat/settings-overhaul – notes for the next chat

- Package 1 is the overview, groups, breadcrumb, TOC and module pages. Plan with all four packages: see the PR text; packages 2–4 wait for the maintainer's go.
- A module setting can carry `group: 'general'|'display'|'notifications'|'data'` and `level: 'advanced'`; without them it lands in General. Modules in another category (accounts → Sicherheit) keep the inline `ModuleSection`.
- Links to a module's settings: `settingsPath('module', 'module-<id>', field)` (now `/settings/module/<id>#…`); old `#module-<id>` anchors redirect.
- Section groups for core sections live in `core/settings/registry/groups.ts` (one table), texts in `strings.settings2.ts`.
- e2e: `/settings` on desktop no longer redirects to Allgemein; use `module-link-<id>` and `module-settings-<id>` test ids.
