# Decisions – website (`site/`)

- 2026-10-06 **Own static package `site/` (Astro), built and deployed separately from the app** – the app's CI ignores `site/`, `site.yml` runs only on site changes; Cloudflare Pages builds from the repository (no secret) and a deploy hook (opt-in, maintainer's choice) rebuilds after a release. Alternatives: GitHub Pages (no preview deployments, no headers file), wrangler deploy from an Action (needs secrets).
- 2026-10-06 **No tracking, no cookies, no external resources** – fonts, logo and screenshots are self-hosted; CSP `script-src 'self'`, the only script is the theme switch (localStorage). Ko-fi and GitHub are links with `rel="noopener"`, never embedded widgets.
- 2026-10-06 **Release data at build time with a committed fallback** – one anonymous API call; buttons always link to `releases/latest/download/<asset>`, so a stale page still downloads the newest release. SHA-256 comes from the API's asset `digest`.
- 2026-10-06 **Design tokens copied, not imported** – `site/src/styles/tokens.css` is a tested subset of `web/src/ui/tokens.css` (`tokens.test.mjs`), so the site has no dependency on the app's build.
- 2026-10-06 **German without prefix, English under `/en`, no auto-redirect by browser language** – explicit switch in header and footer, `hreflang` alternates on every page.
- 2026-10-06 **Legal pages ship as placeholders** – structure plus a short note on what usually belongs into a German Impressum/Datenschutzerklärung; no invented personal data, explicitly no legal advice.
