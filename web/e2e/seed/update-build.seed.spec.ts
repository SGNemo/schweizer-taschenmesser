import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { bootDev } from './helpers';

/**
 * Update test build A → B (UI audit 2026-11, package 0a-2): a page that was opened before an update asks for
 * script files the server no longer has. The app is served from the built Dev-Preview folder (build A); while the
 * page is open the server switches to build B, a copy in which every script and style file has another hash (what a
 * new build of changed sources looks like to the browser: the old addresses answer 404, `index.html` names the new
 * ones). A route change inside the app must then show the card "Neu laden", never a lasting "…"; the reload brings
 * the page from build B. No service worker here (the installed PWA shows "Update verfügbar" instead, pwa/UpdatePrompt);
 * the desktop app stays a hand test (docs/MANUAL-TESTS.md, update N → N+1).
 */
const DIST = resolve(process.cwd(), 'dist-e2e-seed');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Copy of the build in which every hashed script and style file is renamed and every reference follows. */
function otherBuild(from: string): string {
  const to = mkdtempSync(join(tmpdir(), 'nemo-build-b-'));
  cpSync(from, to, { recursive: true });
  const assets = join(to, 'assets');
  const renamed = new Map<string, string>();
  for (const file of readdirSync(assets)) {
    const ext = extname(file);
    if (ext !== '.js' && ext !== '.css') continue;
    const next = `${file.slice(0, -ext.length)}B${ext}`;
    renameSync(join(assets, file), join(assets, next));
    renamed.set(file, next);
  }
  const texts = [
    join(to, 'index.html'),
    ...readdirSync(assets)
      .filter((f) => ['.js', '.css'].includes(extname(f)))
      .map((f) => join(assets, f)),
  ];
  // File names are unique words (`Name-hash.js`): longest first, so no name is replaced inside a longer one.
  const names = [...renamed.keys()].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(
    names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
    'g',
  );
  for (const path of texts) {
    const before = readFileSync(path, 'utf8');
    const after = before.replace(pattern, (name) => renamed.get(name)!);
    if (after !== before) writeFileSync(path, after);
  }
  return to;
}

let server: Server;
let origin = '';
let buildB = '';
let root = DIST;

test.beforeAll(async () => {
  expect(
    existsSync(join(DIST, 'index.html')),
    'dist-e2e-seed is built by the seed web server',
  ).toBe(true);
  buildB = otherBuild(DIST);
  server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
    const file = join(root, path);
    const send = (target: string, status = 200) => {
      res.writeHead(status, {
        'content-type': TYPES[extname(target)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(readFileSync(target));
    };
    if (file.startsWith(root) && existsSync(file) && extname(file)) return send(file);
    // A file that is gone is gone (the old build's scripts); every other address is a page of the app.
    if (extname(path)) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('not found');
    }
    send(join(root, 'index.html'));
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://localhost:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise((done) => server?.close(done));
  if (buildB) rmSync(buildB, { recursive: true, force: true });
});

test('a page opened before an update shows "Neu laden", and the reload brings the new build', async ({
  page,
}) => {
  root = DIST;
  await bootDev(page);
  await page.goto(`${origin}/settings/darstellung`);
  await expect(page.locator('main h1')).toBeVisible();
  const scriptsA = await page.evaluate(() =>
    [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')),
  );

  // The update happens while the page is open.
  root = buildB;
  await page.evaluate(() => {
    history.pushState({}, '', '/todos');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  const card = page.getByTestId('page-loading-card');
  await expect(card).toBeVisible();
  await expect(page.locator('main [role=status]').filter({ hasText: /^…$/ })).toHaveCount(0);
  await expect(page.getByTestId('module-error')).toHaveCount(0);

  await card.getByRole('button', { name: 'Neu laden' }).click();
  await expect(page.locator('main h1')).toHaveText(/ToDos/);
  await expect(card).toHaveCount(0);
  const scriptsB = await page.evaluate(() =>
    [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')),
  );
  expect(scriptsB, 'the reload runs build B').not.toEqual(scriptsA);
});
