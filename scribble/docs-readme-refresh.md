# docs/readme-refresh – for the next chat:

README, repo presence and the website texts were brought up to the state of `develop` (1.0.0, not yet released; the latest stable release is still `v0.3.1`).

## What changed for you
- **Module lists are generated.** Rename a module, change its description, area or platform → run `npm run gen:modules` in `web/` (`--check` only verifies). It rewrites the marked blocks in `README.md`, `README.de.md`, `docs/user/modules{,.de}.md` and `site/src/catalog/modules.json` (the website list, all five languages). The one-line text is the first clause of the manifest description (`scripts/lib/moduleList.ts`, `shortText`).
- **README pictures** come from the seeded build: `npm run app:screenshots -- --readme` in `site/` (see `site/README.md`). The social preview: `npm run gen:social` in `web/` (it uses the overview picture). `gen:icons` no longer writes it.
- **Doc links:** `npm run check:doclinks` in `web/` (`--external` asks the web, too; the agent sandbox only reaches GitHub, so shields.io, ko-fi.com and the website could not be checked there).

## Pictures to renew after the fix PRs (A–D)
All were taken from `develop` at 63175bd3. Known layout flaws in them: the calendar week grid clips the first hour rows under the all-day band (desktop), the phone FAB covers an entry (calendar phone), the settings status tiles truncate (phone) and the module cards under the status head wrap "Benachrichtigungen". Renew `calendar-*`, `settings-*` and `overview-*` first, the others only if their page changed.

## Findings outside this PR's scope
- **App text:** the Google connector intro says everything is read-only, but `gmail.modify` and `gmail.send` exist as opt-in scopes (`i18n/locales/*/connectors.ts`, German source in `strings.ts`).
- **Rules understand German only** (questions, "Add with AI"): the README now says so; if that changes, update the README and `docs/user/ai-assistant*.md`.
- **Dev docs still say "Settings → App updates"** (`docs/howto/ci.md`, `docs/MANUAL-TESTS.md`); the app label is Settings → Updates (section "App updates").
- **`server/docker-compose.yml:4`** points to the README for `tailscale serve`; the how-to is in `docs/user/sync.md`. There is no published Docker image (README says so).
- **CI badge:** the README badge points at `ci.yml` on `develop`, which is correct. It showed "failing" because the latest completed runs were red (seed E2E `seed.spec.ts:49`, see BOARD; `accounts/strengthOffline.test.tsx` hit its 20 s timeout once) or cancelled by the old concurrency rule (fixed in #460).
- **Release:** `CHANGELOG.md` has a `[1.0.0]` section but no tag exists; the README on `main` stays old until the maintainer syncs `develop` into `main` with the release.
- **Browser extension:** only a CI artifact (`nemo-extension-*.zip`), no store and no release asset. If that changes, update the README details, `docs/user/browser-extension*.md` and `SECURITY.md`.
