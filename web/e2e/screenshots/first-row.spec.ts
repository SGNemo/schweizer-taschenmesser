import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { bootDev, seedApp } from '../seed/helpers';

/**
 * Where does the content start on a phone? Measures the y position (px from the top of the screen)
 * of the first list entry per page and the height of the frame above it (topbar, area label/tabs,
 * title) on the seeded Dev-Preview build. Measuring only: writes <dir>/first-row.json.
 * Manual use: STIMULUS_DIR=test-results/first-row npm run measure:stimulus (results: docs/product/next/04-header-results.md).
 */
const OUT = process.env.STIMULUS_DIR ?? 'test-results/stimulus';
const VPS = [
  { name: 'pixel-7', width: 412, height: 839 },
  { name: '412x915', width: 412, height: 915 },
];
const PAGES = [
  ['todos', '/todos'],
  ['calendar', '/calendar'],
  ['finance', '/finance'],
  ['pantry', '/pantry'],
];

test('first content row on a phone', async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const result: Record<string, unknown>[] = [];
  for (const vp of VPS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2.625,
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    await bootDev(page);
    await seedApp(page, 'medium');
    for (const [name, path] of PAGES) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      const notice = page.getByRole('button', { name: 'Schließen', exact: true });
      if (await notice.count()) await notice.first().click();
      await page.waitForTimeout(700);
      const m = await page.evaluate(() => {
        const main = document.querySelector('main')!;
        const row = [...main.querySelectorAll('[data-row], ul li, [role=listitem]')].find((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.top > main.getBoundingClientRect().top;
        });
        const h1 = main.querySelector('h1');
        return {
          firstRowY: row ? Math.round(row.getBoundingClientRect().top) : null,
          h1Bottom: h1 ? Math.round(h1.getBoundingClientRect().bottom) : null,
          mainTop: Math.round(main.getBoundingClientRect().top),
        };
      });
      result.push({ vp: vp.name, page: name, ...m });
    }
    await context.close();
  }
  writeFileSync(`${OUT}/first-row.json`, JSON.stringify(result, null, 1));
});
