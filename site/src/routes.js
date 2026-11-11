// Route table: the same page per language (German without prefix, English under /en). Plain JS so astro.config.mjs
// can read it too (sitemap alternates); src/i18n/index.ts re-exports it with its types.
export const routes = /** @type {const} */ ({
  home: { de: '/', en: '/en' },
  modules: { de: '/module', en: '/en/modules' },
  data: { de: '/daten', en: '/en/data' },
  install: { de: '/install', en: '/en/install' },
  support: { de: '/unterstuetzen', en: '/en/support' },
  imprint: { de: '/impressum', en: '/en/imprint' },
  privacy: { de: '/datenschutz', en: '/en/privacy' },
});
