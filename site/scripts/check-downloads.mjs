/**
 * Checks that the download links the page uses resolve to a real file (final status 200).
 * Uses a ranged GET so nothing big is downloaded. Fails (exit 1) when a link is broken.
 */
import { ASSETS, DEV_PREVIEW, downloadUrl } from '../src/config.js';

const urls = [...Object.values(ASSETS).map(downloadUrl), ...Object.values(DEV_PREVIEW)];
let failed = 0;
for (const url of urls) {
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-0', 'User-Agent': 'nemo-site-check' }, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
    const ok = res.status === 200 || res.status === 206;
    console.log(`${ok ? 'ok ' : 'FAIL'} ${res.status} ${url}`);
    if (!ok) failed++;
    await res.body?.cancel();
  } catch (err) {
    console.log(`FAIL ${err instanceof Error ? err.message : err} ${url}`);
    failed++;
  }
}
process.exit(failed ? 1 : 0);
