import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { bootDev, seedApp } from '../seed/helpers';
import { mockWeather } from '../weather-mock';

/**
 * Settings identity v3.1 before/after shots (docs/design/settings-v3/ROUND-1.md). Not part of CI. Usage (web/, seeded
 * preview on :4174): copy into e2e/screenshots/, then
 *   SHOTS_DIR=../docs/design/settings-v3/shots SHOTS_PREFIX=before npx playwright test -c playwright.settings-v3.config.ts
 * One jpg per tab × {1920, 412} × {light, dark}, full page; the setup assistant opened from Settings.
 */
const OUT = process.env.SHOTS_DIR ?? 'test-results/settings-v3';
const PREFIX = process.env.SHOTS_PREFIX ?? 'before';
const TABS = (process.env.SHOTS_TABS ??
  'index,allgemein,darstellung,barrierefreiheit,module,werkzeuge,benachrichtigungen,sicherheit,sync,ki,verbindungen,schnellerfassung,einrichtung,updates,entwickler,ueber'
).split(',');

const RUNS = [
  { name: '1920-light', width: 1920, height: 1080, scheme: 'light' as const },
  { name: '1920-dark', width: 1920, height: 1080, scheme: 'dark' as const },
  { name: '412-light', width: 412, height: 915, scheme: 'light' as const, mobile: true },
  { name: '412-dark', width: 412, height: 915, scheme: 'dark' as const, mobile: true },
];

async function settle(page: Page) {
  await expect(page.locator('main')).toBeVisible();
  const notice = page.getByRole('button', { name: 'Schließen', exact: true });
  if (await notice.count()) await notice.first().click();
  await page.waitForTimeout(700);
}

/** Desktop: `main` scrolls, not the document; grow the viewport to the page for a full shot. */
async function fullShot(page: Page, mobile: boolean, width: number, height: number, path: string) {
  if (mobile) {
    await page.screenshot({ path, fullPage: true, type: 'jpeg', quality: 70 });
    return;
  }
  const h = await page.evaluate(() => {
    const main = document.getElementById('main');
    return main ? Math.min(main.scrollHeight + main.getBoundingClientRect().top, 7000) : innerHeight;
  });
  await page.setViewportSize({ width, height: Math.max(height, Math.ceil(h)) });
  await page.waitForTimeout(300);
  await page.screenshot({ path, type: 'jpeg', quality: 70 });
  await page.setViewportSize({ width, height });
}

for (const run of RUNS) {
  test(`settings ${run.name}`, async ({ browser }) => {
    mkdirSync(OUT, { recursive: true });
    const mobile = run.mobile ?? false;
    const context = await browser.newContext({
      viewport: { width: run.width, height: run.height },
      isMobile: mobile,
      hasTouch: mobile,
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
      colorScheme: run.scheme,
    });
    const page = await context.newPage();
    await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
    await mockWeather(page);
    await page.addInitScript((desk) => {
      localStorage.setItem('tm-show-preview', '1');
      if (desk) localStorage.setItem('__tmPlatformKind', 'desktop');
    }, !mobile);
    await bootDev(page);
    await seedApp(page, 'medium');
    const overflow: Record<string, number> = {};
    const primaries: Record<string, number> = {};
    for (const tab of TABS) {
      const path = tab === 'index' ? '/settings' : `/settings/${tab}`;
      await page.goto(path);
      await settle(page);
      if (tab !== 'index' && (await page.getByText('Diese Kategorie gibt es nicht').count())) continue;
      primaries[tab] = await page.evaluate(
        () =>
          [...document.querySelectorAll('main button[class*="primary"]')].filter((b) => (b as HTMLElement).offsetParent !== null).length,
      );
      overflow[tab] = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      await fullShot(page, mobile, run.width, run.height, `${OUT}/${PREFIX}-${tab}-${run.name}.jpg`);
    }
    // The setup assistant, opened from its settings entry.
    await page.goto(TABS.includes('einrichtung') && PREFIX !== 'before' ? '/settings/einrichtung' : '/settings/ueber#setup');
    await settle(page);
    const start = page.getByRole('button', { name: /Einrichtung (starten|fortsetzen)/ }).first();
    if (await start.count()) {
      await start.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/${PREFIX}-wizard-${run.name}.jpg`, type: 'jpeg', quality: 70 });
    }
    console.log(`${run.name} overflow`, JSON.stringify(overflow));
    console.log(`${run.name} primaries`, JSON.stringify(primaries));
    await context.close();
  });
}
