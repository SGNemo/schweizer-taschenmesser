/**
 * Build step: refresh src/release/latest.json from the GitHub API (anonymous, one request).
 * Any failure (offline, rate limit, odd answer) keeps the committed file and never fails the
 * build; the page then shows the last known version. Set NO_RELEASE_FETCH=1 to skip the request.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { toReleaseInfo, isReleaseInfo } from './lib/release.mjs';

const REPO = 'SGNemo/schweizer-taschenmesser';
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'release', 'latest.json');

const current = JSON.parse(await readFile(file, 'utf8'));
if (!isReleaseInfo(current)) {
  console.error('fetch-release: committed src/release/latest.json has an unexpected shape');
  process.exit(1);
}

if (process.env.NO_RELEASE_FETCH) {
  console.log(`fetch-release: skipped (NO_RELEASE_FETCH), keeping ${current.tag}`);
  process.exit(0);
}

try {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'nemo-site-build' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} (rate limit left: ${res.headers.get('x-ratelimit-remaining')})`);
  const info = toReleaseInfo(await res.json());
  if (info.tag === current.tag && JSON.stringify(info.assets) === JSON.stringify(current.assets)) {
    console.log(`fetch-release: ${info.tag} unchanged`);
  } else {
    await writeFile(file, JSON.stringify(info, null, 2) + '\n');
    console.log(`fetch-release: updated ${current.tag} → ${info.tag}`);
  }
} catch (err) {
  console.warn(`fetch-release: ${err instanceof Error ? err.message : err}; keeping ${current.tag}`);
}
