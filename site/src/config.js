/**
 * Site-wide constants. Plain JS (not TS) so astro.config.mjs can import it too.
 *
 * SITE_URL: the public origin (production). Cloudflare Pages may override it with the SITE_URL
 * environment variable; preview deployments fall back to Cloudflare's CF_PAGES_URL so canonical
 * links point at the preview itself.
 */
export const SITE_URL = process.env.SITE_URL || process.env.CF_PAGES_URL || 'https://nemo-adhd-helper.online';

export const REPO = 'SGNemo/schweizer-taschenmesser';
export const REPO_URL = `https://github.com/${REPO}`;
export const RELEASES_URL = `${REPO_URL}/releases`;
export const CHANGELOG_URL = `${REPO_URL}/blob/main/CHANGELOG.md`;
export const ROADMAP_URL = `${REPO_URL}/blob/develop/docs/ROADMAP.md`;
/** User docs per site locale: English source `<name>.md`, German translation `<name>.de.md`. */
const userDoc = (name) => ({
  de: `${REPO_URL}/blob/develop/docs/user/${name}.de.md`,
  en: `${REPO_URL}/blob/develop/docs/user/${name}.md`,
});
export const INSTALL_DOCS_URL = userDoc('installation');
export const SECURITY_DOCS_URL = userDoc('security');
export const SUPPORTER_DOCS_URL = `${REPO_URL}/blob/develop/docs/howto/supporter.md`;

/** Same value as web/src/pages/settings/supporterLinks.ts (SUPPORT_PAGE_URL); kept in step by scripts/links.test.mjs. */
export const KOFI_URL = 'https://ko-fi.com/nemojr';

/** Stable asset names of a release (web/scripts/lib/releaseAssets.ts). */
export const ASSETS = {
  windows: 'Nemo-Portable.exe',
  android: 'Nemo.apk',
};
export const DEV_PREVIEW = {
  windows: `${REPO_URL}/releases/download/dev-preview/Nemo-Portable-dev.exe`,
  android: `${REPO_URL}/releases/download/dev-preview/Nemo-dev.apk`,
};
export const downloadUrl = (name) => `${REPO_URL}/releases/latest/download/${name}`;
