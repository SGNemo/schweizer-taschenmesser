import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { bootDev, SEED_TODAY, seedApp } from '../seed/helpers';
import { mockSpotify, seedConnected } from '../spotify-mock';
import { mockWeather, pickWeatherPlace } from '../weather-mock';

/**
 * Manual tooling for the identity v3 work (docs/design/identity-v3/): every module entry page, the overview, library,
 * tools and settings in five viewports, light and dark, reading aid off and on. Next to the full shots it crops the
 * module head and every overview widget (for the "all heads" / "all widgets" contact sheets) and measures horizontal
 * overflow of the document, the main region and the elements that stick out. Not part of CI.
 *
 * Usage (in web/, both preview servers running or started by the config):
 *   SCREENS_DIR=test-results/screens/v3 npx playwright test -c playwright.screens.config.ts identity-v3 --project=seeded
 * Filters: SCREENS_VIEWPORTS=1920x1080,412x915 SCREENS_SCHEMES=light SCREENS_READ_MODES=off SCREENS_PAGES=calendar
 */
const OUT = process.env.SCREENS_DIR ?? 'test-results/screens/identity-v3';
const VIEWPORTS = [
  { name: '1280x720', width: 1280, height: 720 },
  // 1920 × 1080 at the 125 % scaling of Windows laptops.
  { name: '1536x864', width: 1536, height: 864 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '2560x1440', width: 2560, height: 1440 },
  { name: '3440x1440', width: 3440, height: 1440 },
  { name: '412x915', width: 412, height: 915, mobile: true },
];
const SCHEMES = (process.env.SCREENS_SCHEMES ?? 'light,dark').split(',') as ('light' | 'dark')[];
const READ_MODES = (process.env.SCREENS_READ_MODES ?? 'off,on').split(',');
/** Coverage of the reading aid when it is on (25 running text … 100 everything). */
const READ_COVER = process.env.SCREENS_READ_COVER ?? '75';
/** SCREENS_VIEWPORTS: names from the list above, or any `<w>x<h>` (added as a desktop viewport). */
const ONLY_VIEWPORTS = process.env.SCREENS_VIEWPORTS?.split(',');
for (const name of ONLY_VIEWPORTS ?? []) {
  const m = /^(\d+)x(\d+)$/.exec(name);
  if (m && !VIEWPORTS.some((v) => v.name === name))
    VIEWPORTS.push({ name, width: Number(m[1]), height: Number(m[2]) });
}
/** SCREENS_LOCAL=key=value,key=value: extra localStorage settings (e.g. tm-text-size=large). */
const LOCAL: [string, string][] = (process.env.SCREENS_LOCAL ?? '')
  .split(',')
  .filter(Boolean)
  .map((kv) => {
    const i = kv.indexOf('=');
    return [kv.slice(0, i), kv.slice(i + 1)];
  });
const ONLY_PAGES = process.env.SCREENS_PAGES ? new RegExp(process.env.SCREENS_PAGES) : undefined;
const WAIT = Number(process.env.SCREENS_WAIT ?? 900);
/** Demo vault passphrase of the seed (modules/accounts/seed.ts). */
const MASTER = 'nemo-demo-tresor'; // gitleaks:allow (invented demo value)
const SCALE = (process.env.SCREENS_SCALE as 'small' | 'medium' | 'large' | undefined) ?? 'medium';

interface Shot {
  name: string;
  path: string;
  /** Crop the module head into heads/ (first page of every module). */
  head?: boolean;
  /** Whole page, not only the viewport. */
  full?: boolean;
  /** Crop every overview widget into widgets/. */
  widgets?: boolean;
  /** Only when posing as the desktop app. */
  desktop?: boolean;
}

const PAGES: Shot[] = [
  { name: 'dashboard', path: '/', full: true, widgets: true },
  { name: 'calendar', path: `/calendar?view=week&date=${SEED_TODAY}`, head: true },
  { name: 'calendar-month', path: `/calendar?view=month&date=${SEED_TODAY}` },
  { name: 'calendar-day', path: `/calendar?view=day&date=${SEED_TODAY}` },
  { name: 'calendar-agenda', path: `/calendar?view=agenda&date=${SEED_TODAY}` },
  { name: 'reminders', path: '/calendar?tab=reminders' },
  { name: 'todos', path: '/todos', head: true },
  { name: 'todos-today', path: '/todos?view=today' },
  { name: 'todos-board', path: '/todos?view=board' },
  { name: 'habits', path: '/habits', head: true },
  { name: 'timetrack', path: '/timetrack', head: true },
  { name: 'weather', path: '/weather', head: true },
  { name: 'people', path: '/people', head: true },
  { name: 'maps', path: '/maps', head: true },
  { name: 'finance', path: '/finance?tab=overview', head: true },
  { name: 'finance-transactions', path: '/finance?tab=transactions' },
  { name: 'invoices', path: '/invoices', head: true },
  { name: 'subscriptions', path: '/subscriptions', head: true },
  { name: 'budgets', path: '/budgets', head: true },
  { name: 'lists', path: '/lists', head: true },
  { name: 'pantry', path: '/pantry', head: true },
  { name: 'bookmarks', path: '/bookmarks', head: true },
  { name: 'feeds', path: '/feeds', head: true },
  { name: 'notes', path: '/notes', head: true },
  { name: 'chat', path: '/chat', head: true },
  { name: 'browser', path: '/browser', head: true, desktop: true },
  { name: 'mail', path: '/mail', head: true, desktop: true },
  { name: 'music', path: '/music', head: true },
  { name: 'vault', path: '/vault', head: true },
  { name: 'disk', path: '/disk', head: true, desktop: true },
  { name: 'downloads', path: '/downloads', head: true, desktop: true },
  { name: 'library', path: '/library' },
  { name: 'library-detail', path: '/library/todos' },
  { name: 'tools', path: '/tools' },
  { name: 'settings', path: '/settings' },
  { name: 'settings-darstellung', path: '/settings/darstellung', full: true },
  { name: 'settings-module', path: '/settings/module', full: true },
  { name: 'settings-sicherheit', path: '/settings/sicherheit' },
  { name: 'settings-module-todos', path: '/settings/module/todos' },
  { name: 'settings-werkzeuge', path: '/settings/werkzeuge', full: true },
  { name: 'settings-schnellerfassung', path: '/settings/schnellerfassung', full: true },
  { name: 'settings-share', path: '/settings/verbindungen#share', full: true },
  { name: 'settings-allgemein', path: '/settings/allgemein', full: true },
  { name: 'settings-benachrichtigungen', path: '/settings/benachrichtigungen', full: true },
  { name: 'settings-sync', path: '/settings/sync' },
  { name: 'settings-ki', path: '/settings/ki', full: true },
  { name: 'settings-verbindungen', path: '/settings/verbindungen', full: true },
];

/** Preview modules and desktop-only modules are off by default: switch them on in IndexedDB (the app has opened the DB). */
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
              deviceId: 'screens',
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

interface Rect {
  left: number;
  right: number;
  width: number;
  height: number;
}
interface Measure {
  innerWidth: number;
  /** Document wider than the window (px). */
  docOverflow: number;
  /** `main` region scrolls horizontally (px). */
  mainOverflow: number;
  main: Rect | null;
  /** The `PageContainer` (first child of main) and its class list (variant). */
  page: Rect | null;
  pageClass: string;
  frame: Rect | null;
  sidebar: Rect | null;
  /** Elements inside main whose right edge lies beyond the window (tag.class right=px). */
  sticking: string[];
  /** Elements inside main that are wider than the page container. */
  widerThanPage: string[];
}

function measure(page: Page): Promise<Measure> {
  return page.evaluate(() => {
    const r = (el: Element | null): Rect | null => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return {
        left: Math.round(b.left),
        right: Math.round(b.right),
        width: Math.round(b.width),
        height: Math.round(b.height),
      };
    };
    const label = (e: Element) => {
      const b = e.getBoundingClientRect();
      const cls = String((e as HTMLElement).className).split(' ')[0] ?? '';
      const tid = e.getAttribute('data-testid');
      return `${e.tagName.toLowerCase()}${cls ? `.${cls}` : ''}${tid ? `[${tid}]` : ''} right=${Math.round(b.right)} w=${Math.round(b.width)}`;
    };
    const doc = document.documentElement;
    const main = document.getElementById('main');
    const pageEl = main?.firstElementChild ?? null;
    const pageRight = pageEl ? pageEl.getBoundingClientRect().right : innerWidth;
    const all = main ? [...main.querySelectorAll<HTMLElement>('*')] : [];
    // An element inside a horizontal scroller that itself fits (a chip row, the hour strip) is scrolled to, not cut off.
    const inScroller = (e: HTMLElement, limit: number): boolean => {
      for (let p = e.parentElement; p && p !== main; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if ((o === 'auto' || o === 'scroll') && p.getBoundingClientRect().right <= limit + 1)
          return true;
      }
      return false;
    };
    const visible = all.filter(
      (e) => e.offsetParent !== null && e.getClientRects().length > 0 && !inScroller(e, innerWidth),
    );
    return {
      innerWidth,
      docOverflow: doc.scrollWidth - doc.clientWidth,
      mainOverflow: main ? main.scrollWidth - main.clientWidth : 0,
      main: r(main),
      page: r(pageEl),
      pageClass: pageEl ? String((pageEl as HTMLElement).className) : '',
      frame: r(document.querySelector('[data-testid="module-frame"]')),
      sidebar: r(document.querySelector('[data-testid="sidebar"]')),
      sticking: visible
        .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
        .slice(0, 8)
        .map(label),
      widerThanPage: visible
        .filter((e) => e.getBoundingClientRect().right > pageRight + 1)
        .slice(0, 8)
        .map(label),
    };
  });
}

async function settle(page: Page) {
  await expect(page.locator('main')).toBeVisible();
  // The one-time Dev-Preview notice appears after every full load: close it for the shot.
  const notice = page.getByRole('button', { name: 'Schließen', exact: true });
  if (await notice.count()) await notice.first().click();
  await page.waitForTimeout(WAIT);
}

async function cropAll(page: Page, selector: string, file: (i: number, key: string) => string) {
  const items = page.locator(selector);
  const n = await items.count();
  for (let i = 0; i < n; i++) {
    const el = items.nth(i);
    if (!(await el.isVisible())) continue;
    const key = (await el.getAttribute('data-testid')) ?? String(i);
    await el.screenshot({ path: file(i, key) });
  }
}

async function newContext(
  browser: Parameters<Parameters<typeof test>[2]>[0]['browser'],
  vp: (typeof VIEWPORTS)[number],
  scheme: 'light' | 'dark',
  read: boolean,
  desktop: boolean,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile ?? false,
    hasTouch: vp.mobile ?? false,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    colorScheme: scheme,
  });
  const page = await context.newPage();
  // No real network: map tiles, fonts of third parties, everything but the app and the mocks below.
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  await mockWeather(page);
  await page.addInitScript(
    ([isDesktop, readOn, cover, local]) => {
      localStorage.setItem('tm-show-preview', '1');
      if (isDesktop) localStorage.setItem('__tmPlatformKind', 'desktop');
      if (readOn) {
        localStorage.setItem('tm-read-aid', '1');
        localStorage.setItem('tm-read-cover', cover);
      }
      for (const [k, v] of local) localStorage.setItem(k, v);
    },
    [desktop, read, READ_COVER, LOCAL] as const,
  );
  await bootDev(page);
  await seedApp(page, SCALE);
  await enableModules(page, [
    'chat',
    'maps',
    'music',
    ...(desktop ? ['disk', 'mail', 'browser', 'downloads'] : []),
  ]);
  if (!(await pickWeatherPlace(page)))
    await page.screenshot({ path: `${OUT}/weather-place-failed--${vp.name}.png` });
  await mockSpotify(page);
  await seedConnected(page, ['show', 'control', 'playlists', 'library', 'history']);
  return { context, page };
}

test('identity v3: capture and measure', async ({ browser }) => {
  // One long tour per run (up to 20 contexts); the per-test limit of the config does not apply.
  test.setTimeout(0);
  for (const scheme of SCHEMES)
    for (const readMode of READ_MODES)
      for (const vp of VIEWPORTS.filter(
        (v) => !ONLY_VIEWPORTS || ONLY_VIEWPORTS.includes(v.name),
      )) {
        const read = readMode === 'on';
        const combo = `${scheme}-read${read ? 'on' : 'off'}`;
        const dir = `${OUT}/${combo}`;
        mkdirSync(`${dir}/heads`, { recursive: true });
        mkdirSync(`${dir}/widgets`, { recursive: true });
        // The phone poses as the PWA / Android app (no desktop-only modules), every desktop size as the Windows app.
        const desktop = !vp.mobile;
        const { context, page } = await newContext(browser, vp, scheme, read, desktop);
        const measures: Record<string, Measure> = {};
        const shot = async (name: string, path: string, opts: Omit<Shot, 'name' | 'path'> = {}) => {
          await page.goto(path);
          await settle(page);
          // The overview loads its widgets lazily (skeletons first): give it twice the time before the crops.
          if (opts.widgets) await page.waitForTimeout(WAIT * 2);
          measures[name] = await measure(page);
          if (opts.full && !vp.mobile) {
            // Desktop: `main` scrolls, not the document, so a full-page shot needs a viewport as tall as the page.
            const height = await page.evaluate(() => {
              const main = document.getElementById('main');
              return main
                ? Math.min(main.scrollHeight + main.getBoundingClientRect().top, 8000)
                : innerHeight;
            });
            await page.setViewportSize({
              width: vp.width,
              height: Math.max(vp.height, Math.ceil(height)),
            });
            await page.waitForTimeout(300);
            await page.screenshot({ path: `${dir}/${vp.name}--${name}.png` });
            await page.setViewportSize({ width: vp.width, height: vp.height });
          } else {
            await page.screenshot({
              path: `${dir}/${vp.name}--${name}.png`,
              fullPage: !!opts.full,
            });
          }
          if (opts.head) {
            const frame = page.getByTestId('module-frame');
            if (await frame.count())
              await frame.screenshot({ path: `${dir}/heads/${vp.name}--${name}.png` });
          }
          if (opts.widgets)
            await cropAll(
              page,
              '[data-testid^="widget-"]',
              (_, key) =>
                `${dir}/widgets/${vp.name}--${key.replace('widget-', '').replace(':', '-')}.png`,
            );
        };
        for (const p of PAGES.filter((x) => !ONLY_PAGES || ONLY_PAGES.test(x.name))) {
          if (p.desktop && !desktop) continue;
          await shot(p.name, p.path, p);
        }
        if (!ONLY_PAGES || ONLY_PAGES.test('extras')) {
          // Sidebar alone, overview "Ausführlich" (all widgets), icon rail, "Ruhig" colour mode.
          await page.goto('/');
          await settle(page);
          const sidebar = page.getByTestId('sidebar');
          if (await sidebar.isVisible())
            await sidebar.screenshot({ path: `${dir}/${vp.name}--sidebar.png` });
          await page.evaluate(() => localStorage.setItem('tm-home-view', 'all'));
          await shot('dashboard-all', '/', { full: true, widgets: true });
          await page.evaluate(() => localStorage.setItem('tm-sidebar', 'narrow'));
          await page.reload();
          await shot('dashboard-rail', '/');
          await shot('calendar-rail', `/calendar?view=week&date=${SEED_TODAY}`);
          await page.evaluate(() => {
            localStorage.removeItem('tm-sidebar');
            localStorage.setItem('tm-color', 'calm');
          });
          await page.reload();
          await shot('dashboard-calm-colour', '/', { full: true });
          await shot('calendar-calm-colour', `/calendar?view=week&date=${SEED_TODAY}`, {
            head: true,
          });
          await page.evaluate(() => {
            localStorage.removeItem('tm-color');
            localStorage.removeItem('tm-home-view');
          });
          // Cockpit last: `?cockpit=1` is remembered (tm-cockpit) and would put every later page into the cockpit panel.
          await shot('cockpit', '/?cockpit=1');
          await page.evaluate(() => localStorage.removeItem('tm-cockpit'));
          await page.goto('/');
          await settle(page);
        }
        if (!ONLY_PAGES || ONLY_PAGES.test('accounts')) {
          // Unlocked vault list (the session key is in memory only, so use client-side navigation).
          await page.goto('/accounts');
          await page.waitForTimeout(300);
          await page.getByLabel('Master-Passwort').fill(MASTER);
          await page.getByRole('button', { name: 'Entsperren' }).click();
          await expect(page.getByRole('button', { name: 'Zugang hinzufügen' })).toBeVisible({
            timeout: 30_000,
          });
          await page.waitForTimeout(WAIT);
          measures.accounts = await measure(page);
          await page.screenshot({ path: `${dir}/${vp.name}--accounts.png` });
          const frame = page.getByTestId('module-frame');
          if (await frame.count())
            await frame.screenshot({ path: `${dir}/heads/${vp.name}--accounts.png` });
        }
        writeFileSync(`${dir}/measure--${vp.name}.json`, JSON.stringify(measures, null, 2));
        await context.close();
      }
});
