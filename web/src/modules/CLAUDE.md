# web/src/modules/ – feature modules

Recipes: `docs/HOW-TO.md`; example module `notes/`; scaffold `web/templates/module/`.

- **Never import another module** (ESLint + `core/modules/registry.test.ts`). Talk via `core/events` and `manifest.contributions`. Only sanctioned reads: `finance` → `subscriptions/public.ts`, `invoices/public.ts`; `budgets` → `finance/public.ts`.
- **Never import `@/core/db/db`; write only via `createRepo`** (`repo.ts` per module). Local-only data: `local: true`. Manifests: no heavy imports (lazy `() => import()` for routes, widgets, importers).
- Every module needs `contributions.onboarding` (importers or `noOnboarding`) and a `layout` when the default (`content`) does not fit. No module-level `max-width` (use `PageContainer`).
- Collection/index change → `npm run db:bump` + add previous stores to `core/db/schema-history.json`. Stored shape change → bump `manifest.version` + `manifest.migrations`.
- `ai.ts`: tiny `aiSchema` (costs tokens on every call); omit it for private or third-party data. Collections with secrets/connector data: `dataApi: false`.
- **`accounts/` (password vault): never add `aiSchema`, `searchable`, widget, calendar item or data-API exposure** (`accounts/__tests__/exclusion.test.ts`). Decrypted data stays in memory only.
- Money = integer cents; dates `YYYY-MM-DD`/`HH:mm`; `now()`/`today()` (`core/time/now.ts`).
- UI: German only via `src/strings.ts`, primitives from `ui/` (`Patterns.tsx`), `data-autofocus` in dialogs, touch targets ≥ 44 px. Add new pages to `e2e/a11y.spec.ts`.

## Module: Pflichtbestandteile

- **Settings:** registry category, no hand-made UI (`docs/howto/new-setting.md`).
- **Seed data:** `seed: { version, dependsOn }` in the manifest (required by the type) + `seed.ts` (deterministic, `small|medium|large`). Recipe: `docs/howto/seed-data.md`. No module without a seed; output changed → bump `seed.version`. Enforced by `core/seed/registry.test.ts` and `npm run check:modules`.
