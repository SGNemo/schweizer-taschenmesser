import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { bootDev, seedApp } from '../seed/helpers';

/** UI round 6: which elements shift after load (layout-shift sources) on the pages with the highest CLS. */
const OUT = process.env.SCREENS_DIR ?? '.screens/round6';
const PAGES = ['/invoices', '/pantry', '/people', '/subscriptions', '/disk', '/budgets', '/todos', '/'];

test('layout-shift sources', async ({ browser }) => {
  test.setTimeout(0);
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'dark',
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('tm-show-preview', '1');
    localStorage.setItem('__tmPlatformKind', 'desktop');
  });
  await page.addInitScript(`
    window.__shifts = [];
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          if (e.hadRecentInput) continue;
          window.__shifts.push({
            t: Math.round(e.startTime), value: e.value,
            sources: (e.sources || []).map((s) => {
              const n = s.node; const el = n && n.nodeType === 1 ? n : n && n.parentElement;
              const cls = el ? String(el.getAttribute('class') || '').split(' ')[0] : '';
              return { tag: el ? el.tagName : '?', cls, testid: el ? el.closest('[data-testid]')?.getAttribute('data-testid') : null,
                text: el ? (el.innerText || '').trim().slice(0, 40) : '',
                from: [s.previousRect.y, s.previousRect.height], to: [s.currentRect.y, s.currentRect.height] };
            }),
          });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}
  `);
  await bootDev(page);
  await seedApp(page, 'medium');
  const out: Record<string, unknown> = {};
  for (const p of PAGES) {
    await page.goto(p);
    await expect(page.locator('main')).toBeVisible();
    await page.waitForTimeout(2500);
    out[p] = await page.evaluate(() => {
      const s = (window as unknown as { __shifts: { value: number }[] }).__shifts;
      const total = s.reduce((a, b) => a + b.value, 0);
      return { total: Math.round(total * 1000) / 1000, shifts: s.filter((x) => x.value > 0.005).slice(0, 12) };
    });
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/cls-sources.json`, JSON.stringify(out, null, 2));
  await context.close();
});
