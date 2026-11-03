# Settings v2 – package 1 (overview, navigation, module pages)

Branch `feat/settings-overhaul`, 2026-11-03. Seeds `medium`, Dev-Preview build; screenshots in [screens/](screens/) (`before/`, `after/`; 1920×1080, 2560×1440, 412×915, light and dark; a selection, the rest on request).

| Area | Before | After |
|---|---|---|
| `/settings` (desktop) | redirect to "Allgemein" | overview of 8 cards (look, security, sync, AI, notifications, updates, storage, modules), each state + context + jump |
| `/settings` (phone) | quick bar + category list | quick bar + cards + category list |
| Navigation | flat list of 13 categories | + "Überblick", groups as second level under the open category (Allgemein, Darstellung, KI, Verbindungen, Über), breadcrumb, TOC from 1440 px |
| Module settings | all modules stacked on one page (about 5000 px at 412 px, raw values) | list of modules (one line each, "n geändert" / "Standard") → page per module with identity head and blocks General · Display · Notifications · Data · Advanced |

Contract: optional `SettingsSectionDef.group|level|scope` and `SettingField.group|level`; `check:modules` rejects unknown values. No key or default changed (`pages/settings/inventory.test.ts`, 4649 unit tests green). E2E: settings, comfort-settings, a11y (settings pages in both themes), network, shortcuts, layout, library, i18n green on desktop and Pixel 7.

Proposals for `@/ui` (not built, local versions in `pages/settings/`): `Breadcrumb`, a `Disclosure` (the "Erweitert" fold and `FoldedGroup` use raw `<details>`).
Not yet (packages 2–4): Erweitert fold per category, "geändert"/reset per setting, live previews, scope labels, profiles, export/import, history, shortcut editor, per-channel notifications, storage page, accessibility category, search upgrades.
