import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { bootDev, seedApp } from '../seed/helpers';

/** UI round 6: measured head-band heights per module (1920 × 1080, seeded) against the two token heights. */
const OUT = process.env.SCREENS_DIR ?? '.screens/round6';
const MODULES = [
  'calendar', 'planner', 'todos', 'habits', 'timetrack', 'weather', 'maps', 'people', 'fitness', 'finance',
  'invoices', 'subscriptions', 'budgets', 'lists', 'pantry', 'bookmarks', 'notes', 'chat', 'browser', 'feeds',
  'mail', 'music', 'vault', 'accounts', 'disk', 'downloads',
];

test('head band heights', async ({ browser }) => {
  test.setTimeout(0);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: 'dark' });
  const page = await context.newPage();
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('tm-show-preview', '1');
    localStorage.setItem('__tmPlatformKind', 'desktop');
  });
  await bootDev(page);
  await seedApp(page, 'medium');
  const out: Record<string, unknown> = {};
  for (const id of MODULES) {
    await page.goto(`/${id}`);
    await expect(page.locator('main')).toBeVisible();
    await page.waitForTimeout(1200);
    out[id] = await page.evaluate(() => {
      const f = document.querySelector<HTMLElement>('[data-testid="module-frame"]');
      if (!f) return null;
      const band = (f.querySelector('[class*="band"]') as HTMLElement | null) ?? f;
      const cs = getComputedStyle(document.documentElement);
      const h1 = f.querySelector('h1');
      const h1s = h1 ? getComputedStyle(h1) : null;
      return {
        frame: Math.round(f.getBoundingClientRect().height),
        band: Math.round(band.getBoundingClientRect().height),
        head: f.getAttribute('data-head') ?? band.getAttribute('data-head'),
        size: f.getAttribute('data-size'),
        tokenTall: cs.getPropertyValue('--head-h-tall').trim(),
        tokenCompact: cs.getPropertyValue('--head-h-compact').trim(),
        h1: h1s ? `${h1s.fontSize}/${h1s.fontWeight}/${h1s.fontFamily.split(',')[0]}` : null,
      };
    });
  }
  writeFileSync(`${OUT}/head-heights.json`, JSON.stringify(out, null, 2));
  await context.close();
});
