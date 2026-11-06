// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE_URL } from './src/config.js';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'never',
  // Spanish, French and Brazilian Portuguese are frozen (docs/i18n/FROZEN.md): old links land on the
  // English page. Cloudflare answers with a 301 from public/_redirects; these pages (meta refresh,
  // no script) cover any other host. Keep both in step with FROZEN_REDIRECTS in src/i18n/index.ts.
  redirects: { '/es': '/en', '/fr': '/en', '/pt-br': '/en' },
  i18n: {
    defaultLocale: 'de',
    locales: ['de', 'en'],
    routing: { prefixDefaultLocale: false, redirectToDefaultLocale: false },
  },
  build: {
    // Keep styles in a file so the CSP can stay `style-src 'self'` (no inline styles).
    inlineStylesheets: 'never',
    format: 'file',
  },
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'de', locales: { de: 'de', en: 'en' } },
      filter: (page) => !page.endsWith('/404'),
    }),
  ],
  // Lucide icons are inlined as SVG; the only script is the tiny theme switch in public/theme.js.
  vite: { build: { assetsInlineLimit: 0 } },
});
