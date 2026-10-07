# Icons, branding and design tokens

Logo/icon pipeline and token rules. Index: [HOW-TO](../HOW-TO.md). Commands run in `web/` unless stated.

## Icons / branding
- Change the logo (one source): edit the parameters in `design/icon/final.params.mjs` (`ICON`: body height, stripes `at/width/bend`, eye, `soften`, `tilt`, colours, tile `plate`, `adaptive` scale; `DEEP` = logo colour; `WORDMARK`; `MASKABLE_SAFE_RADIUS`). Then
  1. `cd design/icon && npm ci && npm run export` writes `web/brand/*.svg` (mark, mono, app icon, maskable, Android layers, wordmarks), the marked block in `web/src/ui/Logo.tsx` (`// brand:begin … // brand:end`) and the splash in `web/index.html` (`<!-- brand:begin --> … <!-- brand:end -->`). Do not edit those blocks by hand. Then `cd ../../web && npm run format` (the generated splash markup is not prettier-formatted).
  2. `cd web && npx tauri icon brand/app-icon.svg && npm run gen:icons` regenerates the Tauri set (Windows sizes, `icon.icns`, Android legacy mipmaps) and re-renders PWA icons (192/512/maskable), `favicon.svg/.ico/-32.png`, `pwa-badge-96.png`, `icon.ico`, the Android adaptive/monochrome/notification layers, the README headers (light + dark) and the social preview, and deletes the unused iOS/appx sets.
  3. `npm test` (`brand-sync.test.ts` keeps SVGs, `Logo.tsx` and splash in step; SVG ids unique per file), commit the results. If the logo colour changes, also `ANDROID_ICON.iconColor` in `core/platform/tauri/index.ts` (+ `tauri.test.ts`).
  Trying a change first: copy a round folder (`design/icon/rounds/6/variants.mjs`), `node render-round.mjs <path>` renders a preview sheet (16–512 px, light/dark, taskbar/tray, Android masks + safe zone, themed icon) without touching the app.
- Wordmark: the outlines of "Nemo" come from Nunito ExtraBold (OFL, see `web/brand/LICENSES.md`), stored once in `design/icon/glyphs.json`; the SVGs contain paths, no font. Concepts live in `design/icon/wordmark.mjs` (`clown` is the current one, parameters `WORDMARK` in `final.params.mjs`; `npm run export` writes `web/brand/logo-wordmark*.svg`).
- Banner (README header light/dark + social preview): composed in `scripts/gen-icons.mjs` from the wordmark SVGs, a faint school of marks and the claim (`CLAIM` in `final.params.mjs` is the source of truth; the list in `gen-icons.mjs` must match). Trying compositions: `cd design/icon && node banners.mjs rounds/<n>` renders `<n>/banners.mjs` into PNGs and sheets without touching the app.
- Android: the launcher layers reach the APK through the copy step after `tauri android init` in `release.yml`; the status-bar icon is `ic_notification` (referenced from `core/platform/tauri/index.ts`).

## Design tokens
- Colours, radii, shadows, type scale, weights, z-index, motion live in `web/src/ui/tokens.css` only. Change a semantic token there; components pick it up. The dark palette exists twice in the file – edit both (`tokens.test.ts` fails if they differ) and keep the contrast pairs AA (the test checks them, incl. `--border-strong` on `--surface-2`). Do not put `--name:` patterns into comments inside the file (the test's parser reads them as declarations).
- New accent colour: add a `:root[data-accent='<name>']` block with `light-dark()` pairs (`--accent`, `-hover`, `-contrast`, `-soft`), extend `ACCENTS` in `web/src/stores/ui.ts`, the `settings.accentOptions` strings and the inline script in `web/index.html`; `tokens.test.ts` lists the variants to check.
- Trying a look before changing tokens: write overrides into a CSS file and render invented data with `SCREENS_CSS=<file> SCREENS_SCHEME=dark npm run screenshots` (see `docs/design-proposals/variant-*.css`). Compare against `docs/screenshots/`.
- Layout helpers instead of inline styles: `patternStyles.hstack/hstackCenter/hstackWrap/grow/plainList/gridList/gapTop/gapBottom/spacer/fieldset/inlineForm` (`web/src/ui/Patterns.module.css`).

