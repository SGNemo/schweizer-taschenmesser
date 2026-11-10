# web/src/modules/ – feature modules

Recipes: `docs/HOW-TO.md`; example module `notes/`; scaffold `web/templates/module/`.

- **Never import another module** (ESLint + `core/modules/registry.test.ts`). Talk via `core/events` and `manifest.contributions`. Only sanctioned reads: `finance` → `subscriptions/public.ts`, `invoices/public.ts`; `budgets` → `finance/public.ts`.
- **Never import `@/core/db/db`; write only via `createRepo`** (`repo.ts` per module). Local-only data: `local: true`. Manifests: lazy `import()` for routes, widgets, importers.
- Every module needs `contributions.onboarding` (importers or `noOnboarding`), an `area` (navigation only) and a `layout` when the default (`content`) does not fit. No module-level `max-width` (use `PageContainer`).
- **Widget (every module ships one):** built from a base type of the widget catalogue (`@/ui`: KPI, due list, progress, checklist, timeline, tiles, status, gauge); red only for overdue/exceeded, a context line for every number; urgent things via `contributions.attention` → "Jetzt wichtig". Spec: `docs/design/DESIGN-SPEC.md` §4a, full text `docs/RULES.md` "Home screen & widgets".
- **Identity (every module):** `identity` (hue, widget, head, signature); the page uses `PageHeader`/`PageTitle`, no own head: `docs/design/MODULE-IDENTITY.md`.
- Collection/index change → `npm run db:bump` + add previous stores to `core/db/schema-history.json`. Stored shape change → bump `manifest.version` + `manifest.migrations`.
- `ai.ts`: tiny `aiSchema` (none for private/third-party data); optional `actions` (`docs/howto/ai-actions.md`) + **5 inputs in `web/tests/ai/eval-set.json`**. Secret/connector collections: `dataApi: false`.
- **`accounts/` (password vault): never add `aiSchema`, `searchable`, widget, calendar item or data-API exposure** (`accounts/__tests__/exclusion.test.ts`). Decrypted data stays in memory only.
- UI: root rule "UI" + `docs/howto/design-rules.md`; `data-autofocus` in dialogs. Add new pages to `e2e/a11y.spec.ts`.

## Module: Pflichtbestandteile

- **Settings:** registry category, no hand-made UI (`docs/howto/new-setting.md`).
- **Seed data:** `seed: { version, dependsOn }` in the manifest (required by the type) + `seed.ts` (deterministic, `small|medium|large`). Recipe: `docs/howto/seed-data.md`. No module without a seed; output changed → bump `seed.version`. Enforced by `core/seed/registry.test.ts`, `check:modules`.
