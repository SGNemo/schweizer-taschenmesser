# Cloudflare checks: what to check when red

Index: [HOW-TO](../HOW-TO.md). Website package: [site/README.md](../../site/README.md), Worker: [services/supporter-webhook/README.md](../../services/supporter-webhook/README.md).

## What exists
- **One Cloudflare check on GitHub: `Cloudflare Pages`** (app `cloudflare-workers-and-pages`, project `nemo-site`). Cloudflare builds `site/` from the repository on every push and PR; nothing in `.github/workflows` deploys. **Production = branch `develop`**; `main` and every PR branch build as **Preview**.
- It is **not** a required check (ruleset `develop`): red never blocks a merge, but a red `develop` means the live site is not updated.
- **GitHub workflow `Website`** (`site.yml`, only for `site/**`): tests, `astro check`, build, links, downloads, Lighthouse (warnings), then the production-mode builds (guard fires without imprint details, builds with invented ones). If it is green and `Cloudflare Pages` is red, the cause is Cloudflare's settings, not the code.
- **Worker `nemo-supporter-webhook`** has no Cloudflare check: it is deployed by hand (`npx wrangler deploy`, no Git integration). Its CI job `Supporter webhook` runs lint, types, tests and a dry-run bundle without secrets.

## Red: in this order
1. **Which environment?** The check summary of a green Preview build lists a *Branch Preview URL*; a failed build has no URL, so look at the branch: `develop` = Production, everything else = Preview.
2. **Open the log:** Cloudflare dashboard → Workers & Pages → `nemo-site` → Deployments → the deployment → *View logs* (link in the check). Find the first `[ERROR]` and match it:

| Log says | Cause | Fix |
|---|---|---|
| `Imprint details missing in the build of branch "<b>"` | `IMPRESSUM_NAME`/`_STREET`/`_POSTCODE_CITY` missing in the environment that builds `<b>`. `src/legal.js` counts `develop` **and `main`** as production, but Cloudflare builds `main` in Preview. | Set the three in **Production and Preview**, or `PRODUCTION_BRANCH` = `develop` in Preview; then *Retry deployment* |
| Wrong Node (log line about the Node version is not 22.x), `EBADENGINE`, Astro refuses to start | `site/.node-version` not read (Root directory is not `site`) or build system older than v3 | Settings → Builds: Root directory `site`, *Build system version* v3; fallback variable `NODE_VERSION` = `22` (the site needs ≥ 22.18: Astro 7 ≥ 22.12, its tests need Node's type stripping) |
| `npm ci` complains that lock and `package.json` differ | `site/package-lock.json` out of step | `cd site && npm install`, commit the lock file |
| `fetch-release: HTTP 403 … keeping <tag>` | GitHub API rate limit for the shared build IP | Nothing: warning only, the committed `src/release/latest.json` is used |
| `copy-brand` cannot find a file | a file under `web/brand`, `web/public`, `docs/brand` was moved | fix `site/scripts/copy-brand.mjs` |

3. **After changing a setting or variable:** Deployments → latest `develop` deployment → *Retry deployment* (variables apply to new builds only; no commit needed).
4. **Reproduce locally** (Node 22 = the Cloudflare default): `cd site && NO_RELEASE_FETCH=1 CF_PAGES=1 CF_PAGES_BRANCH=develop npm run build` must stop with the imprint message; add `IMPRESSUM_NAME=… IMPRESSUM_STREET=… IMPRESSUM_POSTCODE_CITY=…` and it builds.
5. **History per commit** (read only): `gh api "repos/SGNemo/schweizer-taschenmesser/commits/<sha>/check-runs?check_name=Cloudflare%20Pages"`. The same SHA can carry a Preview build (PR branch) and a Production build, so look at the summary, not only the conclusion.

## Settings that must hold (Cloudflare UI, never via the API from a chat)
Project `nemo-site` · Production branch `develop` · Framework Astro · Root directory `site` · Build command `npm ci && npm run build` · Output `dist` · Build system v3 · variables as in [site/README.md](../../site/README.md) step 3 · no secrets needed to build. Optional deploy hook `release` → GitHub secret `CF_PAGES_DEPLOY_HOOK` (the release job rebuilds the site through it; a hook build fails like any other without the imprint variables).

## Red or yellow but harmless
- **`in_progress` for hours on an older commit:** a newer push to the same branch superseded that build and Cloudflare never closed the check. Only the head of a branch counts.
- **A preview for every PR, also docs-only:** by design; optional *Build watch paths* in site/README.md step 4. Set them only after the builds are green, otherwise fewer builds just delay the proof.
- **Lighthouse below 95:** warning in the `Website` workflow, never blocks.
