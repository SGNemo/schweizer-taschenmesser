# Nemo website (`site/`)

Static site for downloading Nemo and supporting the project. Own package, own build, own CI job
(`.github/workflows/site.yml`); it never touches the app. Texts are German with English, Spanish,
French and Brazilian Portuguese under `/en`, `/es`, `/fr`, `/pt-br`; code and comments are English.

## Stack and rules
- **Astro 7**, static output, no client JavaScript except `public/theme.js` (theme switch, ~1 KB,
  stores the choice in `localStorage` only). No cookies, no analytics, no external scripts or
  fonts. Every link to GitHub/Ko-fi carries `rel="noopener"`.
- **Design** (rethink round, `docs/design/site/RETHINK.md`; building blocks: `docs/design/site/README.md`): colours and
  scale are a subset of the app's tokens (`src/styles/tokens.css`; `scripts/tokens.test.mjs` fails when a value
  differs, when a token is neither the app's nor listed as site-only, or when a component writes a colour or an inline
  style). The site has its own form: one typeface (Atkinson Hyperlegible Next Variable, OFL, copied at build time from
  `node_modules/@fontsource-variable/atkinson-hyperlegible-next`), heavy headlines, ruled sections. Module colours
  appear only as the dot before a module's name (`src/styles/identity.css` maps `data-hue` to `--module-color`, no
  inline styles). **No app picture:** every picture place is a slot (`src/components/Slot.astro`, `src/slots.js`)
  filled by a drawing until `npm run app:screenshots` writes its four pictures (`docs/design/site/SLOTS.md`).
  The module lists come from `src/catalog/modules.json` through `src/catalog/shipped.ts` (shipped modules only, no
  preview module); `scripts/catalog.test.mjs` checks icons, hues, areas, platform labels and the slots.
  Icons are Lucide (ISC) inlined in `Icon.astro`; the licence notice is `web/brand/LICENSES.md`. Logo, favicons, the
  font and the social preview are copied at build time (`scripts/copy-brand.mjs`; logo and favicons are git-ignored).
- **Downloads:** `scripts/fetch-release.mjs` reads `releases/latest` from the GitHub API once per
  build (anonymous, 10 s timeout) and refreshes `src/release/latest.json` (version, date, size and
  SHA-256 per asset, taken from the API's `digest`). On any failure the committed JSON is kept,
  so the build never breaks. Buttons link to `releases/latest/download/<asset>`, which GitHub
  always resolves to the newest stable release even if the page is stale.
- **Security headers and caching:** `public/_headers` (Cloudflare Pages): strict CSP
  (`script-src 'self'`, `style-src 'self'`), `_astro/*` and fonts immutable for a year, HTML
  5 minutes.
- **Focus guidelines** (`docs/design/FOCUS-GUIDELINES.md`): nothing on the site moves; hover/focus change colour
  only (150 ms), one accent colour, calm wording, no countdowns or pop-ups. One honest sentence about ADHD, further
  down the start page, never a headline.
- **Navigation without script:** under 64 rem the links are a second header row that stays on top while the logo
  row scrolls away.
- **Design rounds** (diagnosis, directions, layout, details, mockups): `docs/design/site/`.

## Layout
```
astro.config.mjs       site URL (env SITE_URL), i18n de/en/es/fr/pt-br, sitemap
src/config.js          SITE_URL placeholder, repository links, Ko-fi URL, asset names
src/i18n/{de,en}.ts    all page texts; src/i18n/index.ts = route table
src/release/latest.json  last known release (updated by the build, committed as fallback)
src/layouts/Base.astro head, meta, OG, hreflang, header, footer · Legal.astro for the legal pages
src/catalog/modules.json  module catalogue from the app (npm run gen:modules in web/) · shipped.ts = areas with
                       their shipped modules (no preview module)
src/slots.js           the picture slots: name, ratio per breakpoint, capture size, app target
src/components/        Home (start page: statement, the day, ledger, areas), ModulesPage, DataPage, SupportPage,
                       InstallGuide (/install: warnings, clicks, SHA-256), Slot (picture slot), Downloads, Ledger
                       ("what goes online"), Header, Footer, Icon (inline Lucide)
src/pages/             index, module, daten, unterstuetzen, install, impressum, datenschutz, 404, robots.txt.ts ·
                       en/index, en/modules, en/data, en/support, en/install, en/imprint, en/privacy
src/assets/slots/      <slot>-{desk,phone}-{light,dark}.png once npm run app:screenshots has run (empty today)
public/                .well-known/security.txt, _headers, theme.js
scripts/               fetch-release, copy-brand, check-links, check-downloads, lighthouse (--dark audits
                       the dark theme), a11y, screenshots (site), app-screenshots (app pictures for the slots),
                       *.test.mjs
```

## Commands (in `site/`)
| Command | What |
|---|---|
| `npm run dev` | dev server (run `npm run build` once first so the brand copies exist) |
| `npm run build` | prebuild (release fetch + brand copy), then `astro build` → `dist/` |
| `npm run preview` | serves `dist/` on <http://localhost:4321> |
| `npm test` | unit tests: tokens and Ko-fi URL pinned to the app, catalogue shapes and icons, release parsing |
| `npm run check` | `astro check` (types, templates) + tests |
| `npm run check:links` | linkinator over `dist/` (internal and external) |
| `npm run check:downloads` | the download URLs answer 200 against the real latest release |
| `npm run a11y` | axe (WCAG 2.1 AA) plus contrast inside the drawings, 44-px targets, overflow and heading order on every page at 360 and 1280, light and dark; needs `npm run preview` |
| `npm run lighthouse` | Lighthouse CI on `dist/` (3 runs, every page of `lighthouserc.cjs`), reports in `.lighthouseci/`; `-- --dark` audits a copy with the dark theme forced |
| `npm run screenshots` | renders the preview at 360/390/768/1280/1440, light and dark → `out/` (`SITE_WIDTHS`, `SITE_PAGES`) |
| `npm run app:screenshots` | app pictures for the picture slots from the seeded app build → `src/assets/slots/` (not run yet: `docs/design/site/SLOTS.md`) |
| `npm run app:screenshots -- --readme` | the README pictures (overview, calendar, finance, toolbox, settings; desktop 1920×1080 and phone 412×915, light and dark, WebP) → `../docs/assets/screenshots/` |

`NO_RELEASE_FETCH=1 npm run build` skips the API call. Chromium for Lighthouse/screenshots:
`PLAYWRIGHT_CHROMIUM=<path>` (default: the pinned path used in the cloud sessions).

## Deployment on Cloudflare Pages (recommended: build from the repository)
1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → choose
   `SGNemo/schweizer-taschenmesser`.
2. Build settings: **Production branch** `develop` (the site lives there; release data comes from
   the GitHub API, not from the branch) · **Framework preset** Astro ·
   **Root directory** `site` · **Build command** `npm ci && npm run build` ·
   **Build output directory** `dist`.
3. Environment variables:
   - **Node** is pinned in the repository (`site/.node-version`, read from the root directory, the same
     file CI uses). `NODE_VERSION` = `22` is only a fallback if the build log shows another version.
   - `SITE_URL` defaults to `https://nemo-adhd-helper.online` (`src/config.js`); previews use
     Cloudflare's own URL.
   - **Imprint details in Production AND Preview:** `IMPRESSUM_NAME`, `IMPRESSUM_STREET`,
     `IMPRESSUM_POSTCODE_CITY` (optional `IMPRESSUM_COUNTRY`). They are read by `src/legal.js` and are
     deliberately not in the repository. `develop` builds in Production, but a push to `main` builds in
     Preview and still counts as production there, so with the variables only in Production every `main`
     build is red. A build without them stops with `Imprint details missing in the build of branch …`
     (first line to look for in the Cloudflare log; checklist: [docs/howto/cloudflare-checks.md](../docs/howto/cloudflare-checks.md)).
     Alternative that keeps the address off the PR previews: variables in Production only, plus
     `PRODUCTION_BRANCH` = `develop` in Preview.
   - A new postal address = edit the variables, then redeploy (no commit).
4. Save and deploy. Preview deployments for pull requests are on by default
   (Settings → Builds & deployments → Preview branches: all non-production branches). Optional,
   once the builds are green: "Build watch paths" `site/*`, `web/brand/*`, `web/public/*`,
   `docs/brand/*` (the build copies logo, favicons and the social preview from the last three, so a
   change there must rebuild too; builds with other changes are skipped).
5. **Custom domain:** Pages project → Custom domains → Set up a domain → enter the domain. If
   DNS is at Cloudflare the CNAME is created for you; otherwise create `CNAME <host> →
   <project>.pages.dev` at your registrar. Certificates are automatic.
6. **Rebuild after each release:** Settings → Builds & deployments → **Deploy hooks → Add deploy
   hook** (name `release`, branch `develop`). Store the URL as the GitHub secret
   `CF_PAGES_DEPLOY_HOOK` (repository → Settings → Secrets and variables → Actions). The
   `release` job of `.github/workflows/release.yml` calls it as its last step ("Rebuild the
   website"); the step is a no-op while the secret is empty.
7. Optional, cookie-free statistics: Pages project → Metrics, or Cloudflare Web Analytics
   (no cookies, no IP storage). Both are off by default; if enabled, add the sentence marked
   `[PLATZHALTER]` in the privacy page.

Alternative B (GitHub Action deploys): `npx wrangler pages deploy dist --project-name <name>`
in a workflow with the secrets `CLOUDFLARE_API_TOKEN` (Pages:Edit) and `CLOUDFLARE_ACCOUNT_ID`,
triggered by `workflow_run` on the release workflow. Needs secrets in GitHub, so A is preferred.

## Updating texts, release data and screenshots
- Texts: `src/i18n/de.ts`, `en.ts`, `es.ts`, `fr.ts`, `pt.ts` (same keys; es/fr/pt are machine-assisted, not yet reviewed by native speakers). The legal pages exist in German and English only; the other languages link to the English ones. Legal pages: `src/pages/impressum.astro`,
  `datenschutz.astro`, `en/imprint.astro`, `en/privacy.astro`; search for `PLATZHALTER` /
  `PLACEHOLDER`.
- Release data refreshes itself on every build; to update the committed fallback run
  `npm run build` and commit `src/release/latest.json`.
- Pictures for the slots (when the app's UI is final): follow `docs/design/site/SLOTS.md`, then `npm run app:screenshots`
  (needs `web/node_modules`). It builds `web/dist-e2e-seed` if missing, serves it, loads the seed "medium" via
  Settings → Entwickler, fixes the clock to the seed date, hides the Dev badge and writes four pictures per slot to
  `src/assets/slots/`. `APP_URL=http://localhost:4174` reuses a running preview, `SCREENS_PAGES=<regex>` filters. Only
  test data, never real data.
  With `--readme` the same script shoots the README motifs instead (see the table above); after a
  big UI change run it again and commit the WebP files together with the README.
- Social preview: `docs/brand/social-preview.png` (1280×640) is copied to `/og-image.png`.

## Offen – macht Sven
- Imprint: `IMPRESSUM_NAME`, `IMPRESSUM_STREET`, `IMPRESSUM_POSTCODE_CITY` are set in the Cloudflare Pages
  environment variables for **Production** (2026-11-04). Set them for **Preview** too (step 3), otherwise
  every `main` build stays red (it is built as a Preview).
- Cloudflare Pages project, custom domain `nemo-adhd-helper.online` (+ `www` redirect) and the
  deploy-hook secret `CF_PAGES_DEPLOY_HOOK` (steps above).
- `public/.well-known/security.txt`: renew `Expires` before 2027-10-01.
- Ko-fi link stays `https://ko-fi.com/nemojr` (pinned to the app's `supporterLinks.ts`); change
  both if it moves.
- Check the social preview after the first deployment (e.g. with a link preview in a chat app).
