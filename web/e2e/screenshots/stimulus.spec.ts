import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { bootDev, seedApp } from '../seed/helpers';

/**
 * Stimulus inventory (focus audit 2): counts visible buttons, links, icons, badge-like elements,
 * colours and page height per view, phone and desktop, on the seeded Dev-Preview build. Manual
 * tooling, not part of CI. Usage: STIMULUS_DIR=test-results/stimulus npm run measure:stimulus
 * Output: <dir>/inventory.json plus one screenshot per view. Compare runs in docs/product/focus/12-results-2.md.
 */
const OUT = process.env.STIMULUS_DIR ?? 'test-results/stimulus';
const VPS = [
  { name: 'desktop', width: 1280, height: 800, mobile: false },
  { name: 'phone', width: 412, height: 915, mobile: true },
];
const PAGES = [
  ['home', '/'],
  ['todos', '/todos'],
  ['calendar', '/calendar'],
  ['reminders', '/calendar?tab=reminders'],
  ['finance', '/finance'],
  ['invoices', '/invoices'],
  ['subscriptions', '/subscriptions'],
  ['budgets', '/budgets'],
  ['notes', '/notes'],
  ['lists', '/lists'],
  ['pantry', '/pantry'],
  ['people', '/people'],
  ['bookmarks', '/bookmarks'],
  ['vault', '/vault'],
  ['settings', '/settings'],
  ['settings-darstellung', '/settings/darstellung'],
  ['settings-benachrichtigungen', '/settings/benachrichtigungen'],
  ['settings-module', '/settings/module'],
];

test('stimulus inventory', async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const result: Record<string, unknown>[] = [];
  for (const vp of VPS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
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
        const vis = (e: Element) => {
          const r = e.getBoundingClientRect();
          const s = getComputedStyle(e);
          return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
        };
        const q = (sel: string, root: ParentNode = document) =>
          [...root.querySelectorAll(sel)].filter(vis);
        const main = document.querySelector('main')!;
        const inView = (e: Element) => {
          const r = e.getBoundingClientRect();
          return r.top < innerHeight && r.bottom > 0;
        };
        const colors = new Set<string>();
        q('*', main).forEach((e) => {
          const s = getComputedStyle(e);
          [s.color, s.backgroundColor, s.borderTopColor].forEach((c) => {
            if (c && !/rgba\(0, 0, 0, 0\)/.test(c)) colors.add(c);
          });
        });
        const small = q('button, a, [role=button], input, select, summary', document).filter(
          (e) => {
            const r = e.getBoundingClientRect();
            return r.height < 44 || r.width < 44;
          },
        ).length;
        return {
          buttons: q('button, [role=button]', document).length,
          links: q('a', document).length,
          inputs: q('input, select, textarea', document).length,
          icons: q('svg', document).length,
          headings: q('h1,h2,h3', main).length,
          badgeLike: q(
            '[class*=badge],[class*=chip],[class*=count],[class*=pill],[class*=tag]',
            document,
          ).length,
          animated: q('*', document).filter((e) => {
            const s = getComputedStyle(e);
            return s.animationName !== 'none' && s.animationDuration !== '0s';
          }).length,
          colors: colors.size,
          textChars: (main.textContent ?? '').replace(/\s+/g, ' ').length,
          firstScreenActions: q('button, a, [role=button]', document).filter(inView).length,
          firstScreenTextChars: q('p,li,h1,h2,h3,span,td', main)
            .filter(inView)
            .map((e) => (e.children.length === 0 ? (e.textContent ?? '').length : 0))
            .reduce((a, b) => a + b, 0),
          scrollHeight: document.documentElement.scrollHeight,
          smallTargets: small,
          h1: main.querySelector('h1')?.textContent ?? '',
        };
      });
      result.push({ vp: vp.name, page: name, ...m });
      await page.screenshot({ path: `${OUT}/${vp.name}--${name}.png`, fullPage: name === 'home' });
    }
    await context.close();
  }
  writeFileSync(`${OUT}/inventory.json`, JSON.stringify(result, null, 1));
});
