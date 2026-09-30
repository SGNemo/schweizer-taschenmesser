# web/src/modules/ – feature modules

Recipes: `docs/HOW-TO.md`. Example of a small complete module: `notes/`; scaffold: `web/templates/module/`.

- **Never import another module** (ESLint + `core/modules/registry.test.ts`). Talk via `core/events` and `manifest.contributions`. Only sanctioned reads: `finance` → `subscriptions/public.ts`, `invoices/public.ts`; `budgets` → `finance/public.ts`.
- **Never import `@/core/db/db`; write only via `createRepo`** (`repo.ts` per module). Local-only data: `local: true`. Keep manifests free of heavy imports (lazy `() => import()` for routes, widgets, importers).
- Every module needs `contributions.onboarding` (importers or `noOnboarding`) and a `layout` when the default (`content`) does not fit. Never set a module-level `max-width` (use `PageContainer` variants).
- Collection/index change → `npm run db:bump` + add previous stores to `core/db/schema-history.json`. Stored shape change → bump `manifest.version` + `manifest.migrations`.
- `ai.ts`: tiny `aiSchema` (costs tokens on every call); omit it for private or third-party data. Collections with secrets/connector data: `dataApi: false`.
- **`accounts/` (password vault): never add `aiSchema`, `searchable`, widget, calendar item or data-API exposure** (`accounts/__tests__/exclusion.test.ts`). Decrypted data stays in memory only.
- Money = integer cents; dates `YYYY-MM-DD`, times `HH:mm`; `now()`/`today()` from `core/time/now.ts`.
- UI: German only via `src/strings.ts`, primitives from `ui/` (`Patterns.tsx`), `data-autofocus` in dialogs, touch targets ≥ 44 px. Add new pages to `e2e/a11y.spec.ts`.
