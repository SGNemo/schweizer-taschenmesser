**English** | [Deutsch](development.de.md)

# Development: running the app locally

## App (`web/`)

Requirement: Node.js ≥ 22.

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

| Command | Purpose |
|---|---|
| `npm run build && npm run preview` | production build on http://localhost:4173 |
| `npm run lint` / `npm run typecheck` | static checks |
| `npm test` | unit and component tests (Vitest) |
| `npm run e2e` | all end-to-end tests (Playwright, desktop + "Pixel 7", including an accessibility check with axe-core), then the multi-device sync tests with a real server |
| `npm run e2e:app` / `npm run e2e:sync` | app tests only / sync tests only |
| `npm run gen:module -- <id> "<Name>"` | create a new module from the template |

For the E2E tests Playwright needs a Chromium (`npx playwright install chromium`, or set `PW_CHROMIUM_PATH`).
The sync tests start the server from `../server` themselves (install its dependencies there first with `npm install`).

More: [`ARCHITECTURE-MAP.md`](../ARCHITECTURE-MAP.md), [`HOW-TO.md`](../HOW-TO.md), [`../CONTRIBUTING.md`](../../CONTRIBUTING.md).
