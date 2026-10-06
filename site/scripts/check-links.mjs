/**
 * Link check of the built site (dist/): every internal and external link must answer.
 * Placeholders (nemo.example, example.com) are skipped; GitHub is retried on 429.
 */
import { LinkChecker } from 'linkinator';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (!existsSync(dist)) {
  console.error('check-links: run `npm run build` first');
  process.exit(1);
}

const checker = new LinkChecker();
const broken = [];
checker.on('link', (r) => {
  if (r.state === 'BROKEN') broken.push(r);
});
const result = await checker.check({
  path: dist,
  recurse: true,
  concurrency: 8,
  retry: true,
  retryErrors: true,
  retryErrorsCount: 3,
  timeout: 20_000,
  linksToSkip: ['^https?://nemo\\.example', '^mailto:', '^https?://[^/]*example\\.com', '^https://docs\\.github\\.com/'],
  urlRewriteExpressions: [{ pattern: /^http:\/\/localhost:\d+\/([^.?#]+)(?:\/)?$/, replacement: 'http://localhost:$1' }],
});
const total = result.links.length;
console.log(`check-links: ${total} links, ${broken.length} broken`);
for (const b of broken) console.log(`  ${b.status} ${b.url} (on ${b.parent})`);
process.exit(result.passed ? 0 : 1);
