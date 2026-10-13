/**
 * Provider details for the imprint and privacy pages. They are NOT in the repository: the build reads
 * them from environment variables (Cloudflare Pages → Settings → Environment variables), so a change of
 * address is a variable edit plus a redeploy, never a commit.
 *
 *   IMPRESSUM_NAME          full name
 *   IMPRESSUM_STREET        street and number
 *   IMPRESSUM_POSTCODE_CITY postcode and city
 *   IMPRESSUM_COUNTRY       optional, default "Deutschland" / "Germany" (language of the page)
 *
 * A production build on Cloudflare Pages (branch `develop` or `main`, or the one named in
 * `PRODUCTION_BRANCH`) fails when one of the three is missing, so the site can never go live with an empty imprint. Local, CI and preview builds
 * show a visible note instead and keep working.
 */
const REQUIRED = ['IMPRESSUM_NAME', 'IMPRESSUM_STREET', 'IMPRESSUM_POSTCODE_CITY'];

/** @returns {{ name: string, street: string, postcodeCity: string, country: { de: string, en: string }, complete: boolean }} */
export function provider(env = process.env) {
  const missing = REQUIRED.filter((key) => !env[key]?.trim());
  const branches = env.PRODUCTION_BRANCH ? [env.PRODUCTION_BRANCH] : ['develop', 'main'];
  const production = env.CF_PAGES === '1' && branches.includes(env.CF_PAGES_BRANCH);
  if (missing.length > 0 && production) {
    throw new Error(
      `Imprint details missing in the production build: set ${missing.join(', ')} in the Cloudflare Pages environment variables (see site/README.md).`,
    );
  }
  const value = (key) => env[key]?.trim() || '(nicht gesetzt / not set)';
  const country = env.IMPRESSUM_COUNTRY?.trim();
  return {
    name: value('IMPRESSUM_NAME'),
    street: value('IMPRESSUM_STREET'),
    postcodeCity: value('IMPRESSUM_POSTCODE_CITY'),
    country: { de: country || 'Deutschland', en: country || 'Germany' },
    complete: missing.length === 0,
  };
}
