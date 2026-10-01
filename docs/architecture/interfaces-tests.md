# Interfaces and tests

Part of the architecture notes ([index](../architecture.md)); map: [ARCHITECTURE-MAP](../ARCHITECTURE-MAP.md). Moved unchanged from the map.

## Important interfaces
- `ModuleManifest` (`core/modules/types.ts`): id, routes, `setupSteps?`, `requires?`, `collections`, `widgets`, `aiSchema?`, `contributions` (`quickAdd`, `calendarItems`, `notifications`, `services`, `onboarding` (required), `aiComputed`, `aiCreateDefaults`, `externalCalendar`), `layout`, `migrations`, `defaultEnabled`, `order`, `devOnly`. `ToolManifest` / `ConnectorDef` also take `setupSteps?`.
- `ToolManifest` (`core/tools/types.ts`).
- `ConnectorDef` / `ConnectorContext` (`core/connectors/types.ts`).
- `AiProvider { id, model, complete(req) }` (`core/ai/providers/types.ts`).
- `SyncAdapter` (`core/sync/types.ts`), `StorageAdapter` (`core/storage/types.ts`), `FieldOp`.
- `PlatformService` (`core/platform/types.ts`): `fetch`, `notifications`, `saveFile`, `clipboard`, `secrets`, `biometrics`, `screen`, `oauth`, `updater`, `localApi`, `disk`, `system`, `lifecycle`, `app`.
- `ImporterMeta` / `ImporterRuntime` / `ImportBatch` (`core/importer/types.ts`).
- Server REST (`server/src/app.ts`): `GET /v1/health`, `GET|PUT /v1/vault`, `POST /v1/push`, `GET /v1/pull`, `POST /v1/reset`, push routes `/v1/push/*`, `GET /v1/proxy?url=`. Local API routes: see [local-api.md](local-api.md).

## Tests
- Unit/component: co-located `*.test.ts(x)` (some in `__tests__/`); `web/vitest.config.ts`, `web/vitest.setup.ts`.
- Disk/system: `modules/disk/__tests__/exclusion.test.ts`, `modules/system/__tests__/system.test.ts`, e2e `e2e/disk.spec.ts`, `e2e/system.spec.ts` (fake platform, invented data only).
- Isolation/privacy guards: `core/modules/registry.test.ts`, `tools/isolation.test.ts`, `connectors/isolation.test.ts`, `core/ai/privacy.test.ts`, `modules/accounts/__tests__/exclusion.test.ts`, `core/sync/contract.test.ts`, `server/test/contract.test.ts`.
- Server: `server/test/*.test.ts` (Vitest + `fastify.inject`). MCP: `mcp/test/mcp.test.ts`. Rust: `web/src-tauri/crates/local-api/tests/server.rs`, `crates/disk-scan/{src,tests}`, `crates/system-info/src`.
- CI jobs (`.github/workflows/ci.yml`, on push to `develop`/`main` and PRs, all in parallel): `changes` (docs-only gate), secret scan (gitleaks, always), web-static, web-unit, web-e2e (4 shards), `web` (aggregates the three under the old check name), server, mcp, multi-device sync E2E, rust (fmt, clippy, tests). Details and cache rules: [howto/ci.md](../howto/ci.md).
- Release (`.github/workflows/release.yml`): tag `v*.*.*`, plus dry runs on `develop` pushes touching `web/src-tauri/**`, `web/scripts/**`, the workflow, and manual dispatch; jobs `secret-scan`, `prepare`, `windows`, `android`, `release`, `summary`.
