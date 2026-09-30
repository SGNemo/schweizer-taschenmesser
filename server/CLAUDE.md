# server/ – sync server

Fastify 5 + better-sqlite3; own `package.json`, no shared package with `web/`. Commands: `npm test` (Vitest + `fastify.inject`, in-memory SQLite), `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, `npm run dev`.

- Files: `src/app.ts` (routes, `buildApp` is async: plugins before routes), `store.ts`, `auth.ts`, `push.ts`, `proxy.ts`, `index.ts`. Env names: `.env.example`.
- **LWW rule lives in `store.ts` (single SQL upsert) and, twice on purpose, in `web/src/core/sync/ops.ts`.** Pinned by `../contract/lww-cases.json`; change both or neither. The server never merges values.
- Auth: bearer tokens (≥ 16 chars, hashed + `timingSafeEqual`) from `SYNC_TOKEN(S)`; refuse to start without one. Every response `cache-control: no-store`.
- `proxy.ts` is an SSRF hazard by nature: keep it narrow (http(s), ports 80/443/8080/8443, private/loopback/link-local blocked per hop, socket pinned to the checked address, feed content types only). Do not loosen; tests in `test/proxy.test.ts`.
- Push and proxy take injectable deps for tests (`web-push` always speaks HTTPS: use `generateRequestDetails`).
- No secrets, tokens or real data in the repo. Docker/compose: `Dockerfile`, `docker-compose.yml` (serves the PWA via `WEB_DIR`).
- Wire-format changes must be reflected in `web/src/core/sync/adapters/selfHosted.ts` and `docs/architecture.md` ("Sync & backup").
