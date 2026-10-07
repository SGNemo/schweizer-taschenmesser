# New tool, connector, setup step, AI provider, importer

Recipes for the other extension points. Index: [HOW-TO](../HOW-TO.md). Commands run in `web/` unless stated.

## New tool
Tools are not modules (no own data, no cross-imports; see `tools/isolation.test.ts`).
1. Create `web/src/tools/<id>/` with `manifest.ts` (copy `tools/uuid/manifest.ts`: `id`, `name`, `icon`, `description`, `group` `basis|extra|dev`, `offline`, `defaultEnabled`, `order`, `component: () => import('./Tool')`), `Tool.tsx`, optional pure `logic.ts` + `logic.test.ts`.
2. Strings under `t.tools.<id>` in `src/strings.ts`. Discovery is automatic (`core/tools/registry.ts` glob).
3. Persist anything through `useSettings` (scope `tools.<id>`); do not import modules, connectors, `core/db`, `core/ai`.
4. No generator exists (`gen:module` is modules only).

## New connector
1. `web/src/connectors/<id>/index.ts` default-exporting a `ConnectorDef` (`core/connectors/types.ts`; model: `connectors/ics/index.ts`, OAuth model: `connectors/google/`). Auto-discovered via glob `connectors/*/index.ts`.
2. Fill `id, name, authType, platforms, features[] (own scopes), calendar? / mail?, isConfigured, settings?`. Use only the `ConnectorContext` (`fetch`, `accessToken()`, `fetchPublic`, scoped `secrets`, `redact()`).
3. Isolation: must not import modules, `@/core/db/*`, `@/core/sync|backup/*`, `@/core/ai/*` (lint + `connectors/isolation.test.ts`). Deliver data via manifest contributions (`externalCalendar`, importer input kind `connector`).
4. Secrets only via `getPlatform().secrets`; error text through `redact()`; tests use invented tokens (allow-list in `.gitleaksignore` / `gitleaks:allow` if needed).
5. Public URLs in the browser need the sync server proxy (`server/src/proxy.ts`).

## New setup step (module / tool / connector)
1. Create the step component (default export, props `SetupStepProps`): keep the draft in state, `registerCommit(async () => …)` in an effect (return `null` on cleanup), `setCanContinue(false)` while input is invalid. Return `'skipped'` from the commit to record the step as skipped.
2. Define it: `setupSteps: SetupStepDef[]` in the manifest (`id` = `<owner id>.<name>`, `title`/`description` from `strings.ts`, `order`, `since` = current `SETUP_VERSION`, optional `when(ctx)` and `isDone(ctx)`, `component: () => import(...)`). Keep heavy imports lazy (`isDone`/`when` run when the checklist renders).
3. Core steps (not owned by a module) go to `core/setup/steps/index.ts`, component in `layout/setup/steps/`.
4. Never write secrets into the setup state; use `getPlatform().secrets` / the crypto service. Reuse existing explicit actions instead of duplicating them.
5. New steps in a later release: bump `SETUP_VERSION` and set `since`; users who finished earlier see them as "Neu" in the checklist.
6. Tests: component test with `registerCommit` harness (see `layout/setup/steps/steps.test.tsx`), plus `registry.test.ts` checks ids/prefixes.

## New AI provider
- **OpenAI-compatible endpoint (usual case):** add a preset in `web/src/core/ai/providers/presets.ts` (`kind: 'openai-compatible'`, base URL, default model/prices/limits, `tier` `local|free|paid`, `mayTrainOnInputs`). No code elsewhere; model names/prices are only editable defaults – verify them.
- **New protocol:** new adapter `core/ai/providers/<name>.ts` implementing `AiProvider` (`types.ts`), map errors to `AiErrorCode`, extend `ProviderKind` (`presets.ts`) and the `kind` enum + `createProviderFor` (`core/ai/config.ts`), all HTTP through `PlatformService.fetch`.
- Add the adapter to `core/ai/privacy.test.ts` (request must contain only question, date, schema text; key only in its header) and a fixture test for request/response shapes. Router/fallback needs no change.

## Import: new importer for a module
Add `ImporterMeta` entries in the module manifest `contributions.onboarding` and a lazy `load()` returning `ImporterRuntime` (parse, dedupe key) – see `modules/todos/onboarding.ts` and `core/importer/types.ts`. Parsers shared in `core/io/`.

