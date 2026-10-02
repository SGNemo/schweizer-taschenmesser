# How-to recipes – Nemo

Commands run in `web/` unless stated. Background: [ARCHITECTURE-MAP](ARCHITECTURE-MAP.md), [architecture index](architecture.md). Definition of done and git rules: root [CLAUDE.md](../CLAUDE.md).

## More recipes (one file per topic, load only what you need)
| File | Covers |
|---|---|
| [howto/new-module.md](howto/new-module.md) | `npm run gen:module`, mandatory widget, platform-only (desktop) modules |
| [howto/merge-retire-module.md](howto/merge-retire-module.md) | merge modules: app migration step, retire the source, redirects |
| [howto/seed-data.md](howto/seed-data.md) | seed data per module, Dev-Preview test data, seeds in E2E and screenshots |
| [howto/new-setting.md](howto/new-setting.md) | settings registry: add a module setting or a section, categories, deep links |
| [howto/new-extension.md](howto/new-extension.md) | tool, connector, setup step, AI provider, importer |
| [howto/design-brand.md](howto/design-brand.md) | logo/icons pipeline (`design/icon/`), wordmark, banner, design tokens, accents |
| [howto/ci.md](howto/ci.md) | CI layout, caches, sharding, doc-only gate, Dev-Preview |
| [howto/browser-extension.md](howto/browser-extension.md) | Brave extension: build, load, connect, flows, troubleshooting, vault bridge (native messaging host), release zip proposal |
| [howto/release-deps.md](howto/release-deps.md) | release procedure (maintainer), Dependabot, CodeQL |

## Set up & run locally
- `cd web && npm ci`, `cd ../server && npm ci` (and `cd ../mcp && npm ci` if you touch `mcp/`, `cd ../packages/vault-core && npm ci` for the shared package, `cd ../extension && npm ci` for the extension).
- Dev server: `npm run dev`. Production build: `npm run build`; serve: `npm run preview` (:4173).
- Native shell: `npm run tauri -- dev` (needs Rust; Linux: `libwebkit2gtk-4.1-dev libgtk-3-dev …`). Compile with embedded frontend: `npm run tauri -- build --debug --no-bundle`.
- Sync server: `cd server && cp .env.example .env` (set `SYNC_TOKEN`, ≥ 16 chars), `npm run dev`. Docker: `server/docker-compose.yml` (serves PWA + API).

## Tests & checks
| What | Command |
|---|---|
| Lint / types / format | `npm run lint`, `npm run typecheck`, `npm run format:check` (also in `server/`, `mcp/`) |
| Unit + component | `npm test` (single file: `npx vitest run <path>`; only files touched since the last commit: `npm run test:changed`; watch mode: `npm run test:watch`) |
| Everyday gate, fast | `npm run check` = format + lint + the three `tsc` projects in parallel with tool caches (~34 s cold, ~6 s warm; CI keeps the plain uncached commands) |
| E2E app (desktop-chrome + pixel-7 + dev flavour `seed-dev`) then sync | `npm run e2e`; parts: `npm run e2e:app`, `npm run e2e:seed`, `npm run e2e:sync` |
| One spec | `npx playwright test e2e/<name>.spec.ts` |
| Server | `cd server && npm test` (+ `typecheck`, `lint`, `build`) |
| MCP wrapper | `cd mcp && npm test` (+ `typecheck`, `lint`) |
| Rust | `cd web/src-tauri && cargo fmt --check && cargo clippy --all-targets --locked -p taschenmesser -p taschenmesser-local-api -p taschenmesser-disk-scan -p taschenmesser-system-info -- -D warnings && cargo test --locked -p …` (per crate: `cargo test -p taschenmesser-disk-scan`; perf: `DISK_SCAN_PERF_FILES=1000000 cargo test -p taschenmesser-disk-scan --release -- --ignored --nocapture perf`). Windows-only code compiles without a Windows box: `rustup target add x86_64-pc-windows-msvc`, then `cargo check -p taschenmesser-disk-scan --target x86_64-pc-windows-msvc` (the main crate needs the Windows toolchain). |
| Version consistency | `npm run version:check` |
- Definition of done: `lint`, `typecheck`, `test`, `e2e` green; CLAUDE.md/docs updated.
- **Unit-test environment:** test files run in `node` by default; a file that needs a DOM (React components, `document`, `localStorage`, `window`, `DOMParser`, code such as `stores/ui.ts` that reads them) starts with `// @vitest-environment jsdom`. A forgotten marker fails with "document is not defined" (or, where app code guards the access with try/catch, silently takes the fallback path – add the marker to any test whose subject touches a DOM global). Building a jsdom per file used to cost more than all test bodies together.
- Sandbox: run e2e/vitest in the foreground (`timeout 115 …`, or `--shard`); background jobs only make progress while a foreground command runs. Never `pkill -f` a pattern that appears in your own command line.
- Before `npm run e2e` stop any own `vite preview` on :4173 (`pkill -f "[v]ite preview"`). Chromium is at `/opt/pw-browsers/chromium`; never `playwright install`.

## Git workflow
- Work on a feature branch, PRs into `develop`; `main` only receives release merges. Conventional Commits (`feat(scope):`, `fix:`, `feat!:`). Merge `develop` into your branch (no rebase of shared history).

## Other recipes
- Regenerate PWA icons: `npm run gen:icons` (native: `npx tauri icon brand/app-icon.svg`, see [howto/design-brand.md](howto/design-brand.md)).
- Screenshots (manual, not CI): `npm run screenshots`; filters `SCREENS_VIEWPORTS`, `SCREENS_PAGES`, `SCREENS_SCHEME=dark`, `SCREENS_DIR`, `SCREENS_CSS`. The README images are `docs/screenshots/readme/dashboard-{light,dark}.png` (1280×720 dashboard).
- Use the local AI import API / MCP: `docs/AI-IMPORT.md`.
