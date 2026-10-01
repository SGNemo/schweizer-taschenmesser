#!/usr/bin/env node
/**
 * Post-release check: every asset of the release (and, for stable releases, the "latest" download
 * links the README badges use) must be downloadable.
 *
 *   node scripts/check-links.mjs --repo owner/name --tag v1.2.0 [--stable]
 */
import { parseArgs } from './lib/args.ts';
import { assetUrls } from './lib/releaseAssets.ts';

const args = parseArgs(process.argv.slice(2));
if (typeof args.repo !== 'string' || typeof args.tag !== 'string') {
  console.error('Usage: check-links.mjs --repo owner/name --tag vX.Y.Z [--stable]');
  process.exit(2);
}

const urls = assetUrls(args.repo, args.tag, { stable: args.stable === true });
const ATTEMPTS = 5;
let failed = 0;

for (const url of urls) {
  let ok = false;
  let detail = '';
  for (let attempt = 1; attempt <= ATTEMPTS && !ok; attempt++) {
    try {
      // A one-byte range request: proves the file is served without downloading it.
      const res = await fetch(url, { headers: { range: 'bytes=0-0' }, redirect: 'follow' });
      ok = res.status === 200 || res.status === 206;
      detail = `HTTP ${res.status}`;
      await res.arrayBuffer().catch(() => undefined);
    } catch (e) {
      detail = e instanceof Error ? e.message : String(e);
    }
    // A freshly created release can take a few seconds to show up on the CDN.
    if (!ok && attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, attempt * 3000));
  }
  console.log(`${ok ? '✓' : '✗'} ${url} (${detail})`);
  if (!ok) failed++;
}
if (failed) {
  console.error(`${failed} of ${urls.length} download links are broken.`);
  process.exit(1);
}
console.log(`All ${urls.length} download links work.`);
