// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE_URL } from './src/config.js';
import { routes } from './src/routes.js';

// Sitemap alternates from the route table: the integration only pairs pages whose paths differ by the locale prefix,
// and most pages have their own slug per language (/module ↔ /en/modules).
const abs = (p) => new URL(p, SITE_URL).toString();
const alternates = new Map(
  Object.values(routes).flatMap((r) => {
    const links = [
      { lang: 'de', url: abs(r.de) },
      { lang: 'en', url: abs(r.en) },
      { lang: 'x-default', url: abs(r.de) },
    ];
    return [
      [abs(r.de), links],
      [abs(r.en), links],
    ];
  }),
);
const bare = (u) => (u.length > 1 ? u.replace(/\/$/, '') : u);

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'never',
  // Spanish, French and Brazilian Portuguese are frozen (docs/i18n/FROZEN.md): old links land on the
  // English page. Cloudflare answers with a 301 from public/_redirects; these pages (meta refresh,
  // no script) cover any other host. Keep both in step (scripts/locales.test.mjs).
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
      serialize: (item) => ({ ...item, links: alternates.get(item.url) ?? alternates.get(bare(item.url)) ?? alternates.get(`${bare(item.url)}/`) ?? item.links }),
    }),
  ],
  // Lucide icons are inlined as SVG; the only script is the tiny theme switch in public/theme.js.
  vite: { build: { assetsInlineLimit: 0 } },
});
