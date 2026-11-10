/**
 * App pictures for the website's picture slots, from the seeded Dev-Preview build of the app (invented test data
 * only). The slots are the table in src/slots.js (spec: docs/design/site/SLOTS.md): for each slot this writes
 * src/assets/slots/<name>-{desk,phone}-{light,dark}.png at the slot's capture size, which has the slot's aspect
 * ratio. As soon as all four files of a slot exist, components/Slot.astro shows them instead of the drawing.
 * Not run in the rethink round: the pictures come when the app's UI is final.
 *
 *   npm run app:screenshots            (in site/; builds ../web dist-e2e-seed if missing, serves it)
 *   APP_URL=http://localhost:4174 …    use a preview that is already running (web: npm run preview:e2e-seed)
 *   SCREENS_PAGES=now|plan             limits the slots
 *
 * A slot with `app.clip` is cut to that element (the capture keeps the slot's ratio around its centre); a slot
 * with `app.todo` still needs a step the screenshot chat has to add (printed as a warning, the whole viewport is
 * shot until then). Notifications are granted so no permission banner shows. The seed's texts are German, so one
 * set serves every site language. The only cosmetic change is the hidden "Dev" badge of the preview flavour.
 *
 *   npm run app:screenshots -- --readme   README motifs instead (../docs/assets/screenshots/*.webp):
 *     overview, calendar, finance, tools, settings; desktop 1920×1080 and phone 412×915, light and dark.
 *     SCREENS_PAGES=calendar|tools limits the motifs, SCREENS_VIEWPORTS=phone the viewport.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { slots } from '../src/slots.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '..', '..', 'web');
const out = path.resolve(here, '..', 'src', 'assets', 'slots');
const SEED_TODAY = '2026-09-29'; // reference date of the seed (web/e2e/seed/helpers.ts)
const SCALE = process.env.SCREENS_SCALE ?? 'medium';
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// One job per slot and viewport kind: `<name>-desk` at the slot's desktop capture size, `<name>-phone` at its phone size.
const PAGES = Object.entries(slots).flatMap(([name, def]) => [
  { name: `${name}-desk`, slot: name, ...def.app, viewport: { width: def.desk[0], height: def.desk[1] } },
  { name: `${name}-phone`, slot: name, ...def.app, viewport: { width: def.phone[0], height: def.phone[1] }, mobile: true },
]);
for (const [name, def] of Object.entries(slots)) if (def.app.todo) console.warn(`slot ${name}: ${def.app.todo} (not automated yet, the viewport is shot as it is)`);
const README = process.argv.includes('--readme');
/** README motifs (docs/assets/screenshots): one overview plus modules with a strong identity, the toolbox, settings. */
const README_PAGES = [
  { name: 'overview', path: '/' },
  { name: 'calendar', path: `/calendar?view=week&date=${SEED_TODAY}` },
  { name: 'finance', path: '/finance?tab=overview' },
  // The toolbox panel (top bar button "Werkzeuge"), not the tool library page.
  { name: 'tools', path: '/', openToolbox: true },
  { name: 'settings', path: '/settings' },
];
const README_VIEWPORTS = [
  // 1920 CSS px at scale 1 is already sharp when GitHub shows it at 900 px; the phone is 2×.
  { name: 'desktop', viewport: { width: 1920, height: 1080 }, scale: 1, mobile: false },
  { name: 'phone', viewport: { width: 412, height: 915 }, scale: 2, mobile: true },
];
const readmeOut = path.resolve(here, '..', '..', 'docs', 'assets', 'screenshots');
const onlyViewports = process.env.SCREENS_VIEWPORTS ? new RegExp(process.env.SCREENS_VIEWPORTS) : null;
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

mkdirSync(README ? readmeOut : out, { recursive: true });

/** What to shoot: the site's pages with their own viewport, or every README motif in each README viewport. */
const jobs = README
  ? README_VIEWPORTS.filter((v) => !onlyViewports || onlyViewports.test(v.name)).flatMap((v) =>
      README_PAGES.filter((x) => !only || only.test(x.name)).map((x) => ({
        ...x,
        file: `${x.name}-${v.name}`,
        viewport: v.viewport,
        mobile: v.mobile,
        scale: v.scale,
      })),
    )
  : PAGES.filter((x) => !only || only.test(x.name)).map((x) => ({
      ...x,
      file: x.name,
      viewport: x.viewport ?? { width: 1280, height: 720 },
      scale: x.mobile ? 2 : 1,
    }));

const browser = await chromium.launch({ executablePath: chromiumPath });
try {
  for (const scheme of ['light', 'dark']) {
    for (const p of jobs) {
      const context = await browser.newContext({
        baseURL: base,
        viewport: p.viewport,
        isMobile: p.mobile ?? false,
        hasTouch: p.mobile ?? false,
        deviceScaleFactor: p.scale,
        reducedMotion: 'reduce',
        colorScheme: scheme,
        // The seed's texts are German; the app follows the device language.
        locale: 'de-DE',
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
      // The Dev-Preview flavour shows a one-time notice a moment after the shell mounts; wait for it, close it.
      await page.getByRole('button', { name: 'Schließen', exact: true }).first().click({ timeout: 3_000 }).catch(() => {});
      if (p.openToolbox) {
        await page.getByRole('button', { name: 'Werkzeuge', exact: true }).first().click();
        const toolbox = page.getByRole('dialog').filter({ hasText: 'Rechner' });
        await toolbox.waitFor();
        // On a phone the panel opens on the tool list; show the calculator like the desktop does.
        if (p.mobile) await toolbox.getByText('Rechner', { exact: true }).first().click();
      }
      await page.addStyleTag({ content: '[data-testid="dev-badge"]{display:none !important}' });
      // The last click leaves the pointer over the page; park it so no row shows a hover underline.
      await page.mouse.move(0, 0);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(Number(process.env.SCREENS_WAIT ?? 600));
      if (README) {
        // WebP keeps the repository light: about 60–150 KB per picture instead of 300+ KB as PNG.
        const file = path.join(readmeOut, `${p.file}-${scheme}.webp`);
        await sharp(await page.screenshot()).webp({ quality: 80, effort: 6 }).toFile(file);
        console.log(path.relative(process.cwd(), file));
      } else {
        const file = path.join(out, `${p.file}-${scheme}.png`);
        // With a clip selector: the viewport-sized cut around the element's centre, so the slot's ratio is kept.
        const box = p.clip ? await page.locator(p.clip).first().boundingBox() : null;
        const clip = box && {
          x: Math.max(0, Math.round(box.x + box.width / 2 - p.viewport.width / 2)),
          y: Math.max(0, Math.round(box.y + box.height / 2 - p.viewport.height / 2)),
          width: p.viewport.width,
          height: p.viewport.height,
        };
        await page.screenshot(clip ? { path: file, clip } : { path: file });
        console.log(path.relative(process.cwd(), file));
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  server?.kill();
}
