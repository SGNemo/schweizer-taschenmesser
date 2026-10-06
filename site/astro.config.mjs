// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE_URL } from './src/config.js';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'never',
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
