import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { bootDev, seedApp } from '../seed/helpers';

/**
 * Manual tooling (focus audit 2): the stimulus numbers of docs/product/focus/10-audit-2.md for the
 * seeded Dev-Preview build (medium data) on a phone and a desktop viewport, plus full-page
 * screenshots. Usage: `MEASURE_OUT=../docs/product/focus/img MEASURE_TAG=after npx playwright test
 * -c playwright.screens.config.ts measure-focus` (needs `npm run build:e2e-seed && npm run
 * preview:e2e-seed`). Counts only visible elements; "small" = an interactive element under 44 px.
 */
const OUT = process.env.MEASURE_OUT ?? 'test-results/measure';
const TAG = process.env.MEASURE_TAG ?? 'run';
const VIEWPORTS = {
  phone: { width: 412, height: 915 },
  desktop: { width: 1280, height: 800 },
};
const PAGES = { home: '/', todos: '/todos' };

async function measure(page: Page) {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const all = (sel: string) => [...document.querySelectorAll(sel)].filter(visible);
    const interactive = all('button, a[href], input, select, textarea, [role="button"]');
    const vh = window.innerHeight;
    const small = interactive.filter((el) => {
      const r = el.getBoundingClientRect();
      return (
        (r.width < 44 || r.height < 44) && !(el as HTMLInputElement).type?.match(/checkbox|radio/)
      );
    });
    return {
      buttons: all('button, [role="button"]').length,
      links: all('a[href]').length,
      inputs: all('input, select, textarea').length,
      icons: all('svg').length,
      headings: all('h1, h2, h3').length,
      smallTargets: small.length,
      firstScreenActions: interactive.filter((el) => el.getBoundingClientRect().top < vh).length,
      scrollHeight: document.documentElement.scrollHeight,
    };
  });
}

for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  test(`measure ${vpName}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await bootDev(page);
    await seedApp(page, 'medium');
    const result: Record<string, unknown> = {};
    for (const [name, url] of Object.entries(PAGES)) {
      await page.goto(url);
      await expect(page.locator('main h1')).toBeVisible();
      await page.waitForTimeout(1500);
      result[name] = await measure(page);
      mkdirSync(OUT, { recursive: true });
      await page.screenshot({ path: `${OUT}/${TAG}-${vpName}-${name}.png`, fullPage: true });
    }
    writeFileSync(`${OUT}/${TAG}-${vpName}.json`, JSON.stringify(result, null, 1));
  });
}
