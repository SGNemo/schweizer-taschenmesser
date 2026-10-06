/**
 * Link check of the built site: serves dist/ like Cloudflare Pages does (clean URLs, `/en` →
 * `en.html`) and follows every internal and external link. Placeholders (nemo.example,
 * example.com) are skipped; flaky hosts are retried. Exit 1 on any broken link.
 */
import { LinkChecker } from 'linkinator';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (!existsSync(dist)) {
  console.error('check-links: run `npm run build` first');
  process.exit(1);
}

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.xml': 'application/xml', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.avif': 'image/avif', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

/** Resolves a request path the way Cloudflare Pages does for a static build with `format: 'file'`. */
async function resolve(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/\/$/, '') || '/index';
  for (const candidate of [clean, `${clean}.html`, `${clean}/index.html`]) {
    const file = path.join(dist, candidate);
    if (!file.startsWith(dist)) continue;
    try {
      if ((await stat(file)).isFile()) return file;
    } catch {}
  }
  return null;
}

const server = createServer(async (req, res) => {
  const file = await resolve(req.url ?? '/');
  if (!file) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const checker = new LinkChecker();
const broken = [];
checker.on('link', (r) => {
  if (r.state === 'BROKEN') broken.push(r);
});
const result = await checker.check({
  path: `${base}/`,
  recurse: true,
  concurrency: 8,
  retry: true,
  retryErrors: true,
  retryErrorsCount: 3,
  timeout: 20_000,
  linksToSkip: ['^https?://nemo\\.example', '^mailto:', '^https?://[^/]*example\\.com'],
});
server.close();
console.log(`check-links: ${result.links.length} links, ${broken.length} broken`);
for (const b of broken) console.log(`  ${b.status} ${b.url} (on ${b.parent})`);
process.exit(result.passed ? 0 : 1);
