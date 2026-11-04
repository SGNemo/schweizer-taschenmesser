// Screenshots of the running seeded Dev-Preview app with the logo in place (the "after" of the PR):
// wide sidebar and rail (light/dark),
// the phone top bar (mark below 416 px, wordmark above), the splash (JavaScript off, so it stays), About.
//
//   cd web && npm run build:e2e-seed && npm run preview:e2e-seed      (port 4174)
//   node tools/app-after.mjs <outDir>      (APP_URL=http://localhost:<port> for another build, e.g. the base branch for the "before")
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(resolve(import.meta.dirname, '../../../web/node_modules/@playwright/test'));
const out = resolve(process.argv[2] ?? 'screens');
mkdirSync(out, { recursive: true });
const BASE = process.env.APP_URL ?? 'http://localhost:4174';
const TODAY = '2026-09-29';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function boot(context) {
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(`${TODAY}T10:00:00`));
  await page.goto(`${BASE}/settings/entwickler`);
  await page.locator('main h1').waitFor();
  const section = page.locator('section[aria-labelledby="developer"]');
  await section.getByLabel('Umfang').selectOption('medium');
  await section.getByTestId('seed-load').click();
  await section.getByTestId('seed-status').filter({ hasText: TODAY }).waitFor({ timeout: 90_000 });
  return page;
}
async function open(page, path, { theme, sidebar }) {
  await page.evaluate(
    ([t, s]) => {
      localStorage.setItem('tm-theme', t);
      if (s === 'rail') localStorage.setItem('tm-sidebar', 'narrow');
      else localStorage.removeItem('tm-sidebar');
    },
    [theme, sidebar ?? 'wide'],
  );
  await page.goto(`${BASE}${path}`);
  await page.locator('main').waitFor();
  const notice = page.getByRole('button', { name: 'Schließen', exact: true });
  if (await notice.count()) await notice.first().click();
  await page.waitForTimeout(700);
}
const ctx = (opts) =>
  browser.newContext({ reducedMotion: 'reduce', locale: 'de-DE', serviceWorkers: 'block', deviceScaleFactor: 2, ...opts });

// Desktop 1440 x 900: wide, rail, About.
{
  const context = await ctx({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  await context.addInitScript(() => localStorage.setItem('tm-seed-autofilled', '1'));
  const page = await boot(context);
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    await open(page, '/', { theme, sidebar: 'wide' });
    await page.screenshot({ path: join(out, `wide-${theme}.png`), clip: { x: 0, y: 0, width: 420, height: 240 } });
    await open(page, '/', { theme, sidebar: 'rail' });
    await page.screenshot({ path: join(out, `rail-${theme}.png`), clip: { x: 0, y: 0, width: 420, height: 240 } });
    // About: the mark at 64 px.
    await open(page, '/settings/ueber', { theme, sidebar: 'wide' });
    const logo = page.locator('main svg[aria-label="Nemo"]').first();
    await logo.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const box = await logo.boundingBox();
    await page.screenshot({
      path: join(out, `about-${theme}.png`),
      clip: { x: Math.max(0, box.x - 32), y: Math.max(0, box.y - 32), width: 620, height: 230 },
    });
  }
  await context.close();
}

// Phone 412 px (the mark, below 416 px) and 600 px (the wordmark).
for (const [name, width] of [
  ['phone-mark', 412],
  ['phone-wordmark', 600],
]) {
  const context = await ctx({ viewport: { width, height: 915 }, isMobile: true, hasTouch: true, colorScheme: 'light' });
  await context.addInitScript(() => localStorage.setItem('tm-seed-autofilled', '1'));
  const page = await boot(context);
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    await open(page, '/', { theme });
    await page.screenshot({ path: join(out, `${name}-${theme}.png`), clip: { x: 0, y: 0, width, height: 70 } });
  }
  await context.close();
}

// Splash: JavaScript off keeps #splash on screen (the tokens' stylesheet is a render-blocking link).
for (const theme of ['light', 'dark']) {
  const context = await ctx({ viewport: { width: 560, height: 360 }, javaScriptEnabled: false, colorScheme: theme });
  const page = await context.newPage();
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(out, `splash-${theme}.png`) });
  await context.close();
}
await browser.close();
console.log('done ->', out);
