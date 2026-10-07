# Nemo website (`site/`)

Static site for downloading Nemo and supporting the project. Own package, own build, own CI job
(`.github/workflows/site.yml`); it never touches the app. Texts are German with English under
`/en`; code and comments are English.

## Stack and rules
- **Astro 7**, static output, no client JavaScript except `public/theme.js` (theme switch, ~1 KB,
  stores the choice in `localStorage` only). No cookies, no analytics, no external scripts or
  fonts. Every link to GitHub/Ko-fi carries `rel="noopener"`.
- **Design** = Nemo tokens: `src/styles/tokens.css` is a subset of `web/src/ui/tokens.css`;
  `scripts/tokens.test.mjs` fails when a colour differs. Logo, favicons, fonts (Inter Variable,
  OFL) and the social preview are copied at build time from `web/brand`, `web/public`,
  `docs/brand` and `node_modules/@fontsource-variable/inter` (`scripts/copy-brand.mjs`, copies are
  git-ignored).
- **Downloads:** `scripts/fetch-release.mjs` reads `releases/latest` from the GitHub API once per
  build (anonymous, 10 s timeout) and refreshes `src/release/latest.json` (version, date, size and
  SHA-256 per asset, taken from the API's `digest`). On any failure the committed JSON is kept,
  so the build never breaks. Buttons link to `releases/latest/download/<asset>`, which GitHub
  always resolves to the newest stable release even if the page is stale.
- **Security headers and caching:** `public/_headers` (Cloudflare Pages): strict CSP
  (`script-src 'self'`, `style-src 'self'`), `_astro/*` and fonts immutable for a year, HTML
  5 minutes.
- **Focus guidelines** (`docs/design/FOCUS-GUIDELINES.md`): no animation (hover/focus change colour
  only, 150 ms), reduced motion respected, one accent colour, calm wording, no countdowns or pop-ups.
- **Design rounds** (diagnosis, directions, layout, details, mockups): `docs/design/site/`.

## Layout
```
astro.config.mjs       site URL (env SITE_URL), i18n de/en, sitemap
src/config.js          SITE_URL placeholder, repository links, Ko-fi URL, asset names
src/i18n/{de,en}.ts    all page texts; src/i18n/index.ts = route table
src/release/latest.json  last known release (updated by the build, committed as fallback)
src/layouts/Base.astro head, meta, OG, hreflang, header, footer · Legal.astro for the legal pages
src/components/        Hero, Features, Data, Focus, Compare, Support, Install, Header, Footer,
                       Shot (one screenshot in both themes), Icon (inline Lucide)
src/pages/             index, impressum, datenschutz, 404, robots.txt.ts · en/index, en/imprint, en/privacy
src/assets/screens/    <page>-{dark,light}.png from the seeded app (npm run app:screenshots; Astro makes AVIF/WebP)
public/                .well-known/security.txt, _headers, theme.js
scripts/               fetch-release, copy-brand, check-links, check-downloads, lighthouse,
                       screenshots (site), app-screenshots (app), *.test.mjs
```

## Commands (in `site/`)
| Command | What |
|---|---|
| `npm run dev` | dev server (run `npm run build` once first so the brand copies exist) |
| `npm run build` | prebuild (release fetch + brand copy), then `astro build` → `dist/` |
| `npm run preview` | serves `dist/` on <http://localhost:4321> |
| `npm test` | unit tests: tokens and Ko-fi URL pinned to the app, release parsing |
| `npm run check` | `astro check` (types, templates) + tests |
| `npm run check:links` | linkinator over `dist/` (internal and external) |
| `npm run check:downloads` | the download URLs answer 200 against the real latest release |
| `npm run lighthouse` | Lighthouse CI on `dist/` (3 runs, `/`, `/en`, `/impressum`), reports in `.lighthouseci/` |
| `npm run screenshots` | renders the preview at 360/768/1280/1920, light and dark → `out/` |
| `npm run app:screenshots` | app screenshots for the page from the seeded app build → `src/assets/screens/` |

`NO_RELEASE_FETCH=1 npm run build` skips the API call. Chromium for Lighthouse/screenshots:
`PLAYWRIGHT_CHROMIUM=<path>` (default: the pinned path used in the cloud sessions).

## Deployment on Cloudflare Pages (recommended: build from the repository)
1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → choose
   `SGNemo/schweizer-taschenmesser`.
2. Build settings: **Production branch** `develop` (the site lives there; release data comes from
   the GitHub API, not from the branch) · **Framework preset** Astro ·
   **Root directory** `site` · **Build command** `npm ci && npm run build` ·
   **Build output directory** `dist`.
3. Environment variables (Production and Preview): `NODE_VERSION` = `22`. `SITE_URL` defaults to
   `https://nemo-adhd-helper.online` (`src/config.js`); previews use Cloudflare's own URL.
4. Save and deploy. Preview deployments for pull requests are on by default
   (Settings → Builds & deployments → Preview branches: all non-production branches, or only
   those that touch `site/` via the "Build watch paths" setting: include `site/*`).
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
- Texts: `src/i18n/de.ts` and `en.ts` (same keys). Legal pages: `src/pages/impressum.astro`,
  `datenschutz.astro`, `en/imprint.astro`, `en/privacy.astro`; search for `PLATZHALTER` /
  `PLACEHOLDER`.
- Release data refreshes itself on every build; to update the committed fallback run
  `npm run build` and commit `src/release/latest.json`.
- Screenshots (after UI changes): `npm run app:screenshots` (needs `web/node_modules`). It builds
  `web/dist-e2e-seed` if missing, serves it, loads the seed "medium" via Settings → Entwickler,
  fixes the clock to the seed date, hides the Dev badge and writes `home`, `phone`, `calendar`,
  `todos`, `finance`, `vault` (unlocked with the seed's demo passphrase) and `reminders`, light and
  dark, to `src/assets/screens/`. `APP_URL=http://localhost:4174` reuses a running preview,
  `SCREENS_PAGES=<regex>` filters. The app UI is German only, so one set serves both languages;
  tile focal points live in `Features.astro` (`focus`). Only test data, never real data.
- Product video (not on the page yet): record the quick capture (Ctrl+K or "+ Neu", type
  "Zahnarzt Di 10 Uhr", Enter, entry appears) in the seeded app at 1280×720, ≤ 20 s, no sound,
  export MP4 (H.264, ≤ 1.5 MB) + WebM and a poster PNG; add a `<video>` with `preload="none"`,
  `controls`, `poster`, no autoplay, a `prefers-reduced-motion` fallback to the poster, in a new
  section between "Gemacht für volle Köpfe" and "Vergleich".
- Social preview: `docs/brand/social-preview.png` (1280×640) is copied to `/og-image.png`.

## Offen – macht Sven
- Impressum: the remaining `[PLATZHALTER]` (full name, street) in `impressum.astro` /
  `en/imprint.astro`, when wanted.
- Cloudflare Pages project, custom domain `nemo-adhd-helper.online` (+ `www` redirect) and the
  deploy-hook secret `CF_PAGES_DEPLOY_HOOK` (steps above).
- `public/.well-known/security.txt`: renew `Expires` before 2027-10-01.
- Ko-fi link stays `https://ko-fi.com/nemojr` (pinned to the app's `supporterLinks.ts`); change
  both if it moves.
- Check the social preview after the first deployment (e.g. with a link preview in a chat app).
