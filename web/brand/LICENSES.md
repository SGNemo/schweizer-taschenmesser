# Brand assets – sources and licences

- **Logo (clownfish) and app icons** – drawn for this project (`logo-mark.svg`, `logo-mono.svg`, `app-icon*.svg`, `android-*.svg`); no third-party artwork. Rendered by `npm run gen:icons` (`scripts/gen-icons.mjs`).
- **Wordmark "Nemo"** (`logo-wordmark*.svg`) – letters outlined from _Nunito ExtraBold_ (SIL Open Font License 1.1, © The Nunito Project Authors, see `LICENSE-Nunito.txt`). Outlined once so no font has to load; the OFL allows this.
- **Inter (variable)** – app typeface, shipped locally through `@fontsource-variable/inter` (SIL OFL 1.1, © The Inter Project Authors, see `LICENSE-Inter.txt`).
- **Lucide icons** – ISC licence (`lucide-react`).

The About section in the settings shows the same notices (`about` in `src/strings.ts`).
