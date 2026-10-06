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
- **Focus guidelines** (`docs/design/FOCUS-GUIDELINES.md`): no animation, reduced motion
  respected, one accent colour, calm wording.

## Layout
```
astro.config.mjs       site URL (env SITE_URL), i18n de/en, sitemap
src/config.js          SITE_URL placeholder, repository links, Ko-fi URL, asset names
src/i18n/{de,en}.ts    all page texts; src/i18n/index.ts = route table
src/release/latest.json  last known release (updated by the build, committed as fallback)
src/layouts/Base.astro head, meta, OG, hreflang, header, footer · Legal.astro for the legal pages
src/components/        Hero, Features, Why, Install, Support, Header, Footer, Icon (inline Lucide)
src/pages/             index, impressum, datenschutz, 404, robots.txt.ts · en/index, en/imprint, en/privacy
src/assets/screens/    overview-{dark,light}.png (app with seed "medium"; Astro makes AVIF/WebP)
public/                .well-known/security.txt, _headers, theme.js
scripts/               fetch-release, copy-brand, check-links, check-downloads, lighthouse,
                       screenshots, *.test.mjs
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

`NO_RELEASE_FETCH=1 npm run build` skips the API call. Chromium for Lighthouse/screenshots:
`PLAYWRIGHT_CHROMIUM=<path>` (default: the pinned path used in the cloud sessions).

## Deployment on Cloudflare Pages (recommended: build from the repository)
1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → choose
   `SGNemo/schweizer-taschenmesser`.
2. Build settings: **Production branch** `main` · **Framework preset** Astro ·
   **Root directory** `site` · **Build command** `npm ci && npm run build` ·
   **Build output directory** `dist`.
3. Environment variables (Production and Preview): `NODE_VERSION` = `22`,
   `SITE_URL` = `https://<your domain>` (production only; previews use Cloudflare's own URL).
4. Save and deploy. Preview deployments for pull requests are on by default
   (Settings → Builds & deployments → Preview branches: all non-production branches, or only
   those that touch `site/` via the "Build watch paths" setting: include `site/*`).
5. **Custom domain:** Pages project → Custom domains → Set up a domain → enter the domain. If
   DNS is at Cloudflare the CNAME is created for you; otherwise create `CNAME <host> →
   <project>.pages.dev` at your registrar. Certificates are automatic.
6. **Rebuild after each release:** Settings → Builds & deployments → **Deploy hooks → Add deploy
   hook** (name `release`, branch `main`). Store the URL as the GitHub secret
   `CF_PAGES_DEPLOY_HOOK` (repository → Settings → Secrets and variables → Actions). Then add
   the step proposed in the PR to the `release` job of `.github/workflows/release.yml`; the
   step is a no-op while the secret is empty:
   ```yaml
         - name: Rebuild the website
           if: env.CF_PAGES_DEPLOY_HOOK != ''
           env:
             CF_PAGES_DEPLOY_HOOK: ${{ secrets.CF_PAGES_DEPLOY_HOOK }}
           run: curl -fsS -X POST "$CF_PAGES_DEPLOY_HOOK" > /dev/null
   ```
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
- Screenshots: in `web/` run `npm run dev:all` (dev build, seed "medium"), then
  `SCREENS_PAGES=home SCREENS_SCALE=medium npm run screenshots` for light and dark
  (`SCREENS_SCHEME`), copy the 1280×720 PNGs to `src/assets/screens/overview-{light,dark}.png`.
  Only test data, never real data.
- Social preview: `docs/brand/social-preview.png` (1280×640) is copied to `/og-image.png`.

## Offen – macht Sven
- Impressum and privacy texts: fill every `[PLATZHALTER]` / `[PLACEHOLDER]` (name, address,
  e-mail, supervisory authority, date); `public/.well-known/security.txt` contact and expiry.
- Cloudflare Pages project, `SITE_URL`, custom domain and DNS (steps above).
- Deploy hook secret and the release-workflow step (step 6).
- Ko-fi link stays `https://ko-fi.com/nemojr` (pinned to the app's `supporterLinks.ts`); change
  both if it moves.
- Check the social preview after the first deployment (e.g. with a link preview in a chat app).
