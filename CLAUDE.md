# CLAUDE.md – Nemo

Local-first modular everyday app (formerly "Schweizer Taschenmesser" – internal identifiers keep that name): PWA + portable Windows exe + Android APK (Tauri 2 shell, same web app). Data in IndexedDB, optional sync, the AI assistant never sees user data.
Code, comments, commits **English**; UI **German only** (`web/src/strings.ts`).
**Stack:** Vite, React 19, TypeScript strict (pinned 6.0.x), Dexie, Zod, zustand, CSS Modules; Tauri 2 (Rust); server Fastify 5 + better-sqlite3; Vitest, Playwright.

## How chats work here
1. Read this file + [docs/README.md](docs/README.md) (index), then load only the doc for your area; do not scan `docs/`. Broad searches: Explore subagent.
2. Start: check [docs/CHATS.md](docs/CHATS.md) and open PRs, add your row (topic, branch, area); remove it in your PR's last commit. Hotspots listed there need a heads-up row first.
3. Branch from fresh `develop` (`feat/…`, `fix/…`, `docs/…`); PR into `develop`; never merge your own PR unless told. Never `main`, tags, releases, force-push, history rewrite on shared branches, branch protection. Bring `develop` in with a merge (no rebase).
4. End: touch only [STATUS](docs/STATUS.md) (one line), [DECISIONS](docs/DECISIONS.md) (new decision: one line + detail in `docs/decisions/`), [ARCHITECTURE-MAP](docs/ARCHITECTURE-MAP.md) / [HOW-TO](docs/HOW-TO.md) on real change. Edit this file only when a root rule changes. Reports go to `docs/security|perf|features|meta`. Keep docs short (`npm run check:docs`, budgets: [docs/meta/DOCS-GUIDE.md](docs/meta/DOCS-GUIDE.md)).
5. **Small PRs:** one topic per PR; big work = packages with a stop between them (own branch + PR each), so the maintainer can pause and resume. Questions to him: bundled, ≤ 4, each with a recommendation; final message = 3 points + PR link.
6. Prompt blocks (git, rules, PR text, questions, closing): [docs/PROMPT-TEMPLATES.md](docs/PROMPT-TEMPLATES.md).

## Commands (run in `web/`; also `server/`, `mcp/`: `npm test|typecheck|lint|format:check|build`)
- `npm run dev:all` (app with test data + local sync server, one command) · `dev` · `build` · `preview` (:4173; stop it before e2e) · `tauri -- dev|build` (Rust needed)
- `npm run check` (format+lint+typecheck, parallel, cached = everyday gate) · `lint` · `typecheck` · `format:check|format` · `check:modules` · `check:docs`
- `npm test` (`test:changed`) · `npm run e2e` (= `e2e:app` + `e2e:sync`); one spec: `npx playwright test e2e/<name>.spec.ts`
- `npm run gen:module -- <id> "<Name>"` · `db:bump` · `gen:icons` · `version:check|sync|set -- <semver>` · `changelog -- --version <x.y.z>`
- Rust, CI layout, release: [docs/HOW-TO.md](docs/HOW-TO.md). Chromium is at `/opt/pw-browsers/chromium`; never `playwright install`.
- **Done =** `check` (or lint + typecheck), `test`, `e2e` green; app starts; docs per step 4; commit + push the branch.

## Layout (map: [docs/ARCHITECTURE-MAP.md](docs/ARCHITECTURE-MAP.md))
`web/` PWA (`src/core` framework, `src/modules/<id>`, `src/tools`, `src/connectors`, `src/ui`, `src/layout`, `src/home`) · `web/src-tauri/` shell (crates `local-api`, `disk-scan`, `system-info`, `vault-bridge`) · `server/` sync server · `mcp/` MCP wrapper · `extension/` Brave extension · `packages/vault-core/` shared generator/origin/protocol · `contract/` LWW fixtures · `design/icon/` logo workshop.

## Hard rules (unabridged, with file refs: [docs/RULES.md](docs/RULES.md); rationale: [docs/DECISIONS.md](docs/DECISIONS.md))
- **Secrets/security – never weaken:** no secrets, tokens or real data in the repo (public); API keys only via `getPlatform().secrets`; bundle id `io.github.sgnemo.taschenmesser` never changes (only the sanctioned `.dev` Dev-Preview app); Android keystore and updater private key never lost or committed; release signing, artifact audit, gitleaks untouched.
- **AI privacy:** assistant sends only instructions, compact `aiSchema`, date, question – never user data (`privacy.test.ts`). `accounts` (vault) never gets `aiSchema`, `searchable`, a widget with entries, calendar item, data API or local API access (`exclusion.test.ts`).
- **Data:** one Dexie table per collection `<moduleId>_<collection>`; envelope `id, createdAt, updatedAt, deviceId, deletedAt, _f`; write only via `createRepo`; modules never import `@/core/db/db`; no non-Dexie await in Dexie transactions. Collection/index change → `npm run db:bump` + previous stores into `core/db/schema-history.json`; shape change → `manifest.version` + `migrations`.
- **Formats:** money integer cents; dates `YYYY-MM-DD`, times `HH:mm` (local); `now()`/`today()` from `core/time/now.ts`, never `Date.now()` in logic.
- **Modules** never import each other (event bus + manifest contributions); only `finance` → `subscriptions/public.ts`, `invoices/public.ts`, `budgets` → `finance/public.ts`. Every module ships a widget built from a base type of the widget catalogue (`@/ui`: KPI, due list, progress, checklist, timeline, tiles, status, gauge; red only for overdue/exceeded, a context line for every number; urgent things via `contributions.attention` → "Jetzt wichtig"; spec `docs/design/DESIGN-SPEC.md` §4a), `contributions.onboarding`, an `area` (navigation only), a `layout` if not default, and seed data (`seed` in the manifest + `seed.ts`; never merge a module without one). Recipe: [docs/howto/new-module.md](docs/howto/new-module.md).
- **Supporter mode:** cosmetic only, nothing behind a paywall, no nag; codes Ed25519-signed and checked offline (`packages/supporter-codes`, no network in `core/supporter`); status is derived from the code; the code-issuing service is separate and knows no user data. [docs/howto/supporter.md](docs/howto/supporter.md)
- **Sync:** field LWW by greatest HLC exists twice (`core/sync/ops.ts`, `server/src/store.ts`), pinned by `contract/lww-cases.json` – change both or neither.
- **Platform:** only `core/platform/**` knows Tauri (`getPlatform()` elsewhere); platform-only modules via `manifest.platforms` + `availableManifests()`.
- **Local API (desktop):** loopback, off by default; never a bind-address setting, CORS, or logging of tokens/bodies; tokens only as SHA-256; AI-import prompt = `buildApiPrompt` (tested). Collections with secrets/connector data: `dataApi: false`.
- **Disk module:** never holds data; delete = node ids → Rust plan → block list (`guard.rs`, do not weaken) → typed confirmation in Rust; recycle bin by default. New Tauri command: `build.rs` `COMMANDS` + `capabilities/desktop.json`.
- **Setup assistant:** progress device-local (`_meta` `setup.state`), step ids only, never secrets, never appears by itself on an installation with data.
- **Focus and attention aids:** every new feature passes the checklist in [docs/design/FOCUS-GUIDELINES.md](docs/design/FOCUS-GUIDELINES.md) (stimulus load, off switch, clear next step, calm wording; no guilt text, no streak loss, no notification floods); wording examples in `docs/design/FOCUS-WORDING.md`.
- **UI (Nemo, German only):** CSS Modules + tokens from `ui/tokens.css` (no hex, own radius/shadow/z-index/weight), shared `@/ui` components, `data-autofocus`, touch ≥ 44 px, `manifest.layout` (no module `max-width`), motion transform/opacity only, AA contrast; colour only with meaning and always with text/icon (`ui/semantics.ts`), long text via `ReadableText` (never vault/inputs/numbers), lists grouped via `GroupedList`. Details: [docs/howto/design-rules.md](docs/howto/design-rules.md).
- **Browser extension (`extension/`):** no vault and no persistent storage of its own; the desktop app is the only source (native messaging, `crates/vault-bridge`); fill/copy/save only after a click, only for the matching origin; strict message schemas, no logging of messages. Rules: [docs/RULES.md](docs/RULES.md), threat model [docs/security/VAULT-EXTENSION.md](docs/security/VAULT-EXTENSION.md).
- **Commits:** Conventional Commits (`feat(scope):`, `fix:`, `feat!:`). **Releases** only by the maintainer: tag or manual dispatch, never both ([docs/howto/release-deps.md](docs/howto/release-deps.md)).

## Where to look
| Need | File |
|---|---|
| Where is X, interfaces, data flow | [ARCHITECTURE-MAP](docs/ARCHITECTURE-MAP.md) → topic notes [architecture.md](docs/architecture.md) |
| Recipe (module, tool, connector, setup step, AI provider, icons, tokens, CI, release) | [HOW-TO](docs/HOW-TO.md) → `docs/howto/` (incl. [gotchas](docs/howto/gotchas.md)) |
| Why was it decided | [DECISIONS](docs/DECISIONS.md) → `docs/decisions/` |
| Status, open items, hardware checklists | [STATUS](docs/STATUS.md), [MANUAL-TESTS](docs/MANUAL-TESTS.md); ideas: [ROADMAP](docs/ROADMAP.md) |
| Local AI import API / MCP (German) | [AI-IMPORT](docs/AI-IMPORT.md) |
| Area rules | `web/src/modules/CLAUDE.md`, `web/src-tauri/CLAUDE.md`, `server/CLAUDE.md` (loaded when working there) |
README stays short and German (no new sections); user docs in `docs/user/`. Latest release: see [STATUS](docs/STATUS.md).
