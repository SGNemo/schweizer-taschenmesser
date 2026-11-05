import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { bootDev, seedApp } from './helpers';

/**
 * Identity v3 frame test (docs/design/identity-v3/02-CONCEPT.md § 1): on the seeded Dev-Preview build, every module's
 * entry page, the overview, library, tools and settings fit every window width, light and dark. Nothing may make the
 * document or `main` scroll sideways, and no element inside `main` may end beyond the window unless it sits in a scroller
 * that itself fits (a chip row on a phone, the hour strip). The area's sub-navigation wraps on the desktop instead of
 * cutting off, and a page narrower than the shell is centred in it.
 */
const VIEWPORTS = [
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1536x864', width: 1536, height: 864 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '2560x1440', width: 2560, height: 1440 },
  { name: '3440x1440', width: 3440, height: 1440 },
  { name: '412x915', width: 412, height: 915, mobile: true },
] as const;

const HERE = dirname(fileURLToPath(import.meta.url));

/** Every module folder with a manifest (the dev-only example included in e2e builds is left out). */
const MODULE_IDS = readdirSync(join(HERE, '../../src/modules'))
  .filter(
    (id) => id !== 'example' && existsSync(join(HERE, '../../src/modules', id, 'manifest.ts')),
  )
  .sort();
const PAGES = [
  '/',
  ...MODULE_IDS.map((id) => `/${id}`),
  '/calendar?view=month',
  '/todos?view=board',
  // One split route per master-detail module (identity v3.1, C18): the detail pane opens beside the list.
  '/finance?tab=transactions',
  '/calendar?view=day',
  '/accounts',
  '/disk?tab=scan',
  '/library',
  '/library/todos',
  '/tools',
  '/settings',
  '/settings/darstellung',
  '/settings/sicherheit',
  '/settings/module/todos',
];

/** Preview modules and the desktop-only ones are off by default: switch them on in IndexedDB. */
async function enableModules(page: Page, ids: readonly string[]) {
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
              deviceId: 'e2e',
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

interface Report {
  docOverflow: number;
  mainOverflow: number;
  /** Elements that end beyond the window (tag.class right=px). */
  sticking: string[];
  /** Elements that clip their own content sideways (`overflow: hidden` without an ellipsis; tag.class +px). */
  clipped: string[];
  subnavOverflow: number;
  /** The sidebar at 1920 × 1080 (identity v3.1, F06): `null` without a wide sidebar. */
  sidebar: { groups: number; links: number; scrolls: boolean; lastBottom: number } | null;
  /** Left/right free space of the page container inside `main` (px), `null` without a container. */
  centre: { left: number; right: number; width: number } | null;
  main: { left: number; right: number } | null;
}

function report(page: Page): Promise<Report> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const main = document.getElementById('main');
    // Inside a horizontal scroller that itself fits, an element is scrolled to, not cut off.
    const inScroller = (e: HTMLElement): boolean => {
      for (let p = e.parentElement; p && p !== main; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if ((o === 'auto' || o === 'scroll') && p.getBoundingClientRect().right <= innerWidth + 1)
          return true;
      }
      return false;
    };
    const sticking = main
      ? [...main.querySelectorAll<HTMLElement>('*')]
          .filter(
            (e) =>
              e.offsetParent !== null &&
              e.getClientRects().length > 0 &&
              e.getBoundingClientRect().right > innerWidth + 1 &&
              !inScroller(e),
          )
          .slice(0, 6)
          .map(
            (e) =>
              `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} right=${Math.round(e.getBoundingClientRect().right)}`,
          )
      : [];
    // Identity v3.1 (C18): content cut off by `overflow: hidden` is as bad as content beyond the window; an ellipsis
    // (or a line clamp) says so and is fine, a horizontal scroller is a scroller.
    const clipped = main
      ? [...main.querySelectorAll<HTMLElement>('*')]
          .filter((e) => {
            if (e.offsetParent === null || e.scrollWidth <= e.clientWidth + 1) return false;
            const cs = getComputedStyle(e);
            if (cs.overflowX !== 'hidden' && cs.overflowX !== 'clip') return false;
            if (cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none') return false;
            // A scroller inside: the content is reachable there.
            return ![...e.children].some((c) => {
              const o = getComputedStyle(c).overflowX;
              return o === 'auto' || o === 'scroll';
            });
          })
          .slice(0, 6)
          .map(
            (e) =>
              `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} +${e.scrollWidth - e.clientWidth}px`,
          )
      : [];
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Hauptnavigation"]');
    const groups = nav ? [...nav.querySelectorAll<HTMLElement>('section[data-area]')] : [];
    const sidebar =
      nav && groups.length > 0
        ? {
            groups: groups.length,
            links: groups.reduce((n, g) => n + g.querySelectorAll('a[href]').length, 0),
            scrolls: [...nav.querySelectorAll<HTMLElement>('*'), nav].some((e) => {
              const o = getComputedStyle(e).overflowY;
              return (o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 1;
            }),
            lastBottom: Math.round(groups[groups.length - 1]!.getBoundingClientRect().bottom),
          }
        : null;
    const subnav = document.querySelector<HTMLElement>('[data-testid="subnav"]');
    const pageEl = main?.querySelector<HTMLElement>('[data-testid="page"]');
    const box = (el: Element | null | undefined) => (el ? el.getBoundingClientRect() : null);
    const pb = box(pageEl);
    const mb = box(main);
    return {
      docOverflow: doc.scrollWidth - doc.clientWidth,
      mainOverflow: main ? main.scrollWidth - main.clientWidth : 0,
      sticking,
      clipped,
      sidebar,
      subnavOverflow: subnav ? subnav.scrollWidth - subnav.clientWidth : 0,
      centre:
        pb && mb
          ? {
              left: Math.round(pb.left - mb.left),
              right: Math.round(mb.right - pb.right),
              width: Math.round(pb.width),
            }
          : null,
      main: mb ? { left: Math.round(mb.left), right: Math.round(mb.right) } : null,
    };
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`overflow ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: 'mobile' in vp,
      hasTouch: 'mobile' in vp,
    });

    for (const scheme of ['light', 'dark'] as const) {
      test(`every page fits the window (${scheme})`, async ({ page }) => {
        test.setTimeout(300_000);
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await page.addInitScript(() => {
          localStorage.setItem('tm-show-preview', '1');
          if (innerWidth >= 900) localStorage.setItem('__tmPlatformKind', 'desktop');
        });
        await bootDev(page);
        await seedApp(page, 'small');
        await enableModules(page, MODULE_IDS);
        for (const path of PAGES) {
          await page.goto(path);
          await expect(page.locator('main h1').first(), path).toBeVisible();
          // The first paint of lazy content (charts, widgets) may still move things: let it settle.
          await page.waitForTimeout(250);
          const r = await report(page);
          expect(r.docOverflow, `${path}: the page scrolls sideways`).toBeLessThanOrEqual(0);
          expect(r.mainOverflow, `${path}: the content area scrolls sideways`).toBeLessThanOrEqual(
            0,
          );
          expect(r.sticking, `${path}: elements end beyond the window`).toEqual([]);
          expect(r.clipped, `${path}: elements clip their content sideways`).toEqual([]);
          // Identity v3.1 (F06): at 1920 × 1080 every area with every module fits the sidebar without scrolling.
          if (vp.width === 1920 && path === '/') {
            expect(r.sidebar, 'sidebar').not.toBeNull();
            expect(r.sidebar!.groups, 'areas in the sidebar').toBe(6);
            expect(r.sidebar!.links, 'modules in the sidebar').toBeGreaterThanOrEqual(
              MODULE_IDS.length,
            );
            expect(r.sidebar!.scrolls, 'the sidebar scrolls').toBe(false);
            expect(
              r.sidebar!.lastBottom,
              'the last area ends inside the window',
            ).toBeLessThanOrEqual(vp.height);
          }
          if (vp.width >= 900)
            expect(r.subnavOverflow, `${path}: the sub-navigation is cut off`).toBeLessThanOrEqual(
              0,
            );
          // A page that does not fill the shell is centred in it (equal air left and right).
          if (r.centre && r.main && r.centre.left > 40)
            expect(
              Math.abs(r.centre.left - r.centre.right),
              `${path}: page not centred`,
            ).toBeLessThanOrEqual(2);
        }
      });
    }
  });
}
