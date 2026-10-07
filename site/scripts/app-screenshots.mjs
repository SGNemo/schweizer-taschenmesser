/**
 * App screenshots for the website, from the seeded Dev-Preview build of the app (invented test
 * data only, docs/design/site). Writes src/assets/screens/<name>-<scheme>.png, light and dark.
 *
 *   npm run app:screenshots            (in site/; builds ../web dist-e2e-seed if missing, serves it)
 *   APP_URL=http://localhost:4174 …    use a preview that is already running (web: npm run preview:e2e-seed)
 *
 * Pages: home (1280×720, hero), phone (412×915), and one 1280×720 shot per feature tile (the vault
 * unlocked with the seed's demo passphrase, notifications granted so no permission banner shows). The app's
 * UI is German only, so one set serves both site languages. The only cosmetic change is the hidden
 * "Dev" badge of the preview flavour; everything else is the real UI.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '..', '..', 'web');
const out = path.resolve(here, '..', 'src', 'assets', 'screens');
const SEED_TODAY = '2026-09-29'; // reference date of the seed (web/e2e/seed/helpers.ts)
const SCALE = process.env.SCREENS_SCALE ?? 'medium';
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const PAGES = [
  { name: 'home', path: '/', viewport: { width: 1280, height: 720 } },
  { name: 'phone', path: '/', viewport: { width: 412, height: 915 }, mobile: true },
  { name: 'calendar', path: `/calendar?view=week&date=${SEED_TODAY}` },
  { name: 'todos', path: '/todos' },
  { name: 'finance', path: '/finance?tab=overview' },
  { name: 'vault', path: '/accounts', unlock: true },
  { name: 'reminders', path: '/calendar?tab=reminders' },
];
const only = process.env.SCREENS_PAGES ? new RegExp(process.env.SCREENS_PAGES) : null;

const run = (args, cwd) =>
  new Promise((resolve, reject) => {
    const c = spawn(npm, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    c.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${args.join(' ')} exited ${code}`))));
  });
const reachable = (url) => fetch(url).then((r) => r.ok, () => false);

let server;
let base = process.env.APP_URL;
if (!base) {
  base = 'http://localhost:4174';
  if (!(await reachable(base))) {
    if (!existsSync(path.join(web, 'node_modules'))) throw new Error('web/node_modules missing: run npm ci in web/ first');
    if (!existsSync(path.join(web, 'dist-e2e-seed'))) await run(['run', 'build:e2e-seed'], web);
    server = spawn(npm, ['run', 'preview:e2e-seed'], { cwd: web, stdio: 'ignore', shell: process.platform === 'win32' });
    for (let i = 0; i < 60 && !(await reachable(base)); i++) await new Promise((r) => setTimeout(r, 500));
  }
}
if (!(await reachable(base))) throw new Error(`App not reachable at ${base}`);

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: chromiumPath });
try {
  for (const scheme of ['light', 'dark']) {
    for (const p of PAGES.filter((x) => !only || only.test(x.name))) {
      const context = await browser.newContext({
        baseURL: base,
        viewport: p.viewport ?? { width: 1280, height: 720 },
        isMobile: p.mobile ?? false,
        hasTouch: p.mobile ?? false,
        deviceScaleFactor: p.mobile ? 2 : 1,
        reducedMotion: 'reduce',
        colorScheme: scheme,
        serviceWorkers: 'block',
        permissions: ['notifications'],
      });
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date(`${SEED_TODAY}T10:00:00`));
      await page.addInitScript(() => localStorage.setItem('tm-seed-autofilled', '1'));
      // Settings → Entwickler → "Testdaten laden" (same steps as web/e2e/seed/helpers.ts seedApp).
      await page.goto('/settings/entwickler');
      const section = page.locator('section[aria-labelledby="developer"]');
      await section.getByLabel('Umfang').selectOption(SCALE);
      await section.getByTestId('seed-load').click();
      await section.getByTestId('seed-status').filter({ hasText: SEED_TODAY }).waitFor({ timeout: 60_000 });
      await page.goto(p.path);
      await page.locator('main').waitFor();
      if (p.unlock) {
        // The vault list: unlock with the demo passphrase of the seed (modules/accounts/seed.ts).
        await page.getByLabel('Master-Passwort').fill('nemo-demo-tresor'); // gitleaks:allow (invented demo value)
        await page.getByRole('button', { name: 'Entsperren' }).click();
        await page.getByRole('button', { name: 'Zugang hinzufügen' }).waitFor({ timeout: 30_000 });
      }
      await page.addStyleTag({ content: '[data-testid="dev-badge"]{display:none !important}' });
      const notice = page.getByRole('button', { name: 'Schließen', exact: true });
      if (await notice.count()) await notice.first().click();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(Number(process.env.SCREENS_WAIT ?? 600));
      const file = path.join(out, `${p.name}-${scheme}.png`);
      await page.screenshot({ path: file });
      console.log(path.relative(process.cwd(), file));
      await context.close();
    }
  }
} finally {
  await browser.close();
  server?.kill();
}
