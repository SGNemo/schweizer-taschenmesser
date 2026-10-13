#!/usr/bin/env node
/**
 * `npm run check:legal`: lists legal placeholders that are still open (`[[…]]`, `[PLATZHALTER: …]`) in the
 * website's legal pages and checks that those pages read the provider's name and address from the build
 * environment (`site/src/legal.js`) instead of the repository. Warns only (exit 0, GitHub `::warning::`
 * annotation) so development and previews are never blocked. `--strict` exits 1: used by the release
 * workflow, see docs/legal/LAUNCH-LEGAL-CHECKLIST.md. The values themselves live in Cloudflare Pages (the
 * production build of the site fails without them), so they are not visible here.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findOpenPlaceholders, readsBuildDetails } from './lib/legalPlaceholders.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = [
  'site/src/pages/impressum.astro',
  'site/src/pages/datenschutz.astro',
  'site/src/pages/en/imprint.astro',
  'site/src/pages/en/privacy.astro',
];
const sources = FILES.map((f) => [f, readFileSync(join(root, f), 'utf8')]);
const hits = sources.flatMap(([f, text]) => findOpenPlaceholders(f, text));
// The imprint and privacy pages must take name and address from the build environment, not hard-code them.
const hardCoded = sources.filter(([, text]) => !readsBuildDetails(text)).map(([f]) => f);
const strict = process.argv.includes('--strict');
for (const f of hardCoded) {
  console.log(
    `${process.env.GITHUB_ACTIONS ? '::warning file=' + f + '::' : ''}legal page does not read the provider details from the build environment (site/src/legal.js): ${f}`,
  );
}
for (const h of hits) {
  console.log(
    `${process.env.GITHUB_ACTIONS ? '::warning file=' + h.file + ',line=' + h.line + '::' : ''}open legal placeholder ${h.text} (${h.file}:${h.line})`,
  );
}
console.log(
  `check:legal: ${hits.length} open placeholder(s), ${hardCoded.length} page(s) with hard-coded details`,
);
if (strict && (hits.length > 0 || hardCoded.length > 0)) process.exit(1);
