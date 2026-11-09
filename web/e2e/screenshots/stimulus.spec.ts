import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { measurePage, surfaceMetrics } from '../../scripts/lib/stimulusBudget';
import { bootDev, seedApp } from '../seed/helpers';
import { mockSpotify, seedConnected } from '../spotify-mock';
import { mockWeather, pickWeatherPlace } from '../weather-mock';
import { MODULE_PAGES, PAGES, VIEWPORTS } from './stimulusPages';

/**
 * Stimulus inventory (focus audit 2, UI audit 2026-11): counts visible buttons, links, icons, framed
 * elements, shadows, colour above the fold, signature blocks and the page height per view, phone and desktop,
 * on the seeded Dev-Preview build. Measuring only: it writes <dir>/inventory.json (plus one screenshot per view
 * unless STIMULUS_SHOTS=0) and checks nothing. The budget check reads the inventory afterwards:
 * `npm run check:stimulus` (scripts/check-stimulus.mjs, docs/howto/ci.md). Same set-up as the audit tour
 * (docs/design/ui-audit-2026-11/tools/audit-tour.spec.ts): desktop platform faked on the desktop window so the
 * desktop-only modules exist, every module switched on, "In Arbeit anzeigen" on, no network but the mocks.
 * Pages and window sizes: `stimulusPages.ts`. This file is ratchet-protected (scripts/ratchet.mjs).
 */
const OUT = process.env.STIMULUS_DIR ?? 'test-results/stimulus';

async function enableModules(page: Page, ids: string[]) {
  await page.evaluate(
    (list) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          for (const id of list)
            tx.objectStore('_modules').put({
              id,
              enabled: true,
              dataPolicy: null,
              createdAt: 1,
              updatedAt: 1,
              deviceId: 'stimulus',
              deletedAt: null,
              _f: {},
            });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    ids,
  );
}

/**
 * Waits until the page has stopped changing: lazy routes, widgets and mocked answers arrive at their own pace,
 * and several budget bands are exact. Stable = element count, heights and text length unchanged for a second.
 */
async function settle(page: Page, name: string) {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  let last = '';
  let same = 0;
  for (let i = 0; i < 60 && same < 4; i++) {
    await page.waitForTimeout(250);
    const now = await page.evaluate(() => {
      const main = document.querySelector('main');
      return [
        document.querySelectorAll('*').length,
        main?.scrollHeight,
        document.documentElement.scrollHeight,
        (main?.textContent ?? '').length,
      ].join('/');
    });
    same = now === last ? same + 1 : 0;
    last = now;
  }
  // Measuring a page that still moves would look like a budget change: fail and name the page instead.
  if (same < 4)
    throw new Error(`${name}: the page did not stop changing within 15 s, nothing measured`);
}

test('stimulus inventory', async ({ browser }) => {
  // Two seedings and every page at two window sizes in one run.
  test.setTimeout(25 * 60_000);
  mkdirSync(OUT, { recursive: true });
  const result: Record<string, unknown>[] = [];
  for (const vp of VIEWPORTS) {
    const desktop = !vp.mobile;
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      deviceScaleFactor: 1,
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
    await mockWeather(page);
    await page.addInitScript((isDesktop) => {
      localStorage.setItem('tm-show-preview', '1');
      if (isDesktop) localStorage.setItem('__tmPlatformKind', 'desktop');
    }, desktop);
    await bootDev(page);
    await seedApp(page, 'medium');
    const modules = [
      ...new Set(MODULE_PAGES.filter((p) => desktop || !p.desktop).map((p) => p.module!)),
    ];
    await enableModules(page, modules);
    expect(await pickWeatherPlace(page), 'weather place (mocked search)').toBe(true);
    // Load the (mocked) forecast once and wait for it. A request cut off by a navigation is noted as failed,
    // and with the frozen clock that note would keep every later page from asking again: the weather page and
    // the overview would then be measured empty in one run and filled in the next.
    await page.evaluate(() => localStorage.removeItem('tm-weather-tried'));
    await page.goto('/weather');
    await page.waitForFunction(() => localStorage.getItem('tm-weather') !== null, null, {
      timeout: 30_000,
    });
    await mockSpotify(page);
    await seedConnected(page, ['show', 'control', 'playlists', 'library', 'history']);
    for (const target of PAGES) {
      if (target.desktop && !desktop) continue;
      if (target.homeView) {
        await page.evaluate((view) => localStorage.setItem('tm-home-view', view), target.homeView);
      }
      await page.goto(target.path);
      await expect(page.locator('main')).toBeVisible();
      const notice = page.getByRole('button', { name: 'Schließen', exact: true });
      if (await notice.count())
        await notice
          .first()
          .click()
          .catch(() => {});
      await settle(page, `${vp.name}--${target.name}`);
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
          // On the desktop `main` scrolls, not the document: take the longer of the two.
          scrollHeight: Math.max(
            document.documentElement.scrollHeight,
            Math.round(main.getBoundingClientRect().top) + main.scrollHeight,
          ),
          smallTargets: small,
          h1: main.querySelector('h1')?.textContent ?? '',
        };
      });
      const surfaces = surfaceMetrics(await page.evaluate(measurePage));
      result.push({ vp: vp.name, page: target.name, ...m, ...surfaces });
      if (process.env.STIMULUS_SHOTS !== '0')
        await page.screenshot({
          path: `${OUT}/${vp.name}--${target.name}.png`,
          fullPage: target.name.startsWith('home'),
        });
    }
    await context.close();
  }
  writeFileSync(`${OUT}/inventory.json`, JSON.stringify(result, null, 1));
});
