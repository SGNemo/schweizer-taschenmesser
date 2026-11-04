// Screenshots of the running app (seeded Dev-Preview build) for the preview sheets: sidebar wide
// and rail, light and dark, desktop at 1x and 2x, plus the phone top bar. The brand image is hidden
// (layout kept) and its box recorded, so the sheet can montage a candidate into the real shell.
//
//   cd web && npm run build:e2e-seed && npm run preview:e2e-seed   (port 4174)
//   node tools/app-shots.mjs <outDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(resolve(import.meta.dirname, '../../../web/node_modules/@playwright/test'));
const out = resolve(process.argv[2] ?? 'shots');
mkdirSync(out, { recursive: true });
const BASE = process.env.APP_URL ?? 'http://localhost:4174';
const TODAY = '2026-09-29';
const exe = '/opt/pw-browsers/chromium';

const browser = await chromium.launch({ executablePath: exe });
const boxes = {};

async function boot(context, page) {
  await page.clock.setFixedTime(new Date(`${TODAY}T10:00:00`));
  await page.goto(`${BASE}/settings/entwickler`);
  await page.locator('main h1').waitFor();
  const section = page.locator('section[aria-labelledby="developer"]');
  await section.getByLabel('Umfang').selectOption('medium');
  await section.getByTestId('seed-load').click();
  await section.getByTestId('seed-status').filter({ hasText: TODAY }).waitFor({ timeout: 90_000 });
}

async function shot(page, name, { theme, sidebar, hide }) {
  await page.evaluate(
    ([t, s]) => {
      localStorage.setItem('tm-theme', t);
      if (s === 'rail') localStorage.setItem('tm-sidebar', 'narrow');
      else localStorage.removeItem('tm-sidebar');
    },
    [theme, sidebar],
  );
  await page.goto(`${BASE}/`);
  await page.locator('main').waitFor();
  const notice = page.getByRole('button', { name: 'Schließen', exact: true });
  if (await notice.count()) await notice.first().click();
  await page.waitForTimeout(700);
  const brand = page.locator('a[aria-label="Zur Übersicht"]:visible').first();
  const img = brand.locator('img, svg').first();
  const b = { brand: await brand.boundingBox(), img: await img.boundingBox() };
  if (hide) await page.addStyleTag({ content: 'a[aria-label="Zur Übersicht"] img, a[aria-label="Zur Übersicht"] svg { visibility: hidden }' });
  await page.waitForTimeout(100);
  await page.screenshot({ path: join(out, `${name}.png`) });
  boxes[name] = b;
  console.log(name, JSON.stringify(b));
}

for (const dpr of [1, 2]) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: dpr,
    reducedMotion: 'reduce',
    locale: 'de-DE',
    serviceWorkers: 'block',
  });
  await context.addInitScript(() => localStorage.setItem('tm-seed-autofilled', '1'));
  const page = await context.newPage();
  await boot(context, page);
  for (const theme of ['light', 'dark'])
    for (const sidebar of ['wide', 'rail']) {
      await shot(page, `desktop-${theme}-${sidebar}-${dpr}x-current`, { theme, sidebar, hide: false });
      await shot(page, `desktop-${theme}-${sidebar}-${dpr}x`, { theme, sidebar, hide: true });
    }
  await context.close();
}
// Phone top bar (wordmark 32 px) at 2x.
const phone = await browser.newContext({
  viewport: { width: 412, height: 915 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  reducedMotion: 'reduce',
  locale: 'de-DE',
  serviceWorkers: 'block',
});
await phone.addInitScript(() => localStorage.setItem('tm-seed-autofilled', '1'));
const pp = await phone.newPage();
await boot(phone, pp);
for (const theme of ['light', 'dark']) {
  await shot(pp, `phone-${theme}-2x-current`, { theme, sidebar: 'wide', hide: false });
  await shot(pp, `phone-${theme}-2x`, { theme, sidebar: 'wide', hide: true });
}
await phone.close();
await browser.close();
writeFileSync(join(out, 'boxes.json'), JSON.stringify(boxes, null, 2) + '\n');
console.log('done');
