import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { bootDev, SEED_TODAY, seedApp } from '../seed/helpers';
import { mockSpotify, seedConnected } from '../spotify-mock';
import { mockWeather, pickWeatherPlace } from '../weather-mock';
import { openToolbox } from '../helpers';

/**
 * Audit tooling (docs/design/identity-v3-audit): blind-test crops (title text blacked out, random file names, key
 * written last), empty states of every module and widget (no seed), the toolbox with three tools open, the overview
 * head. Not part of CI. Usage (web/, seeded preview on :4174):
 *   SCREENS_DIR=<dir> npx playwright test -c playwright.screens.config.ts identity-audit --project=seeded
 */
const OUT = process.env.SCREENS_DIR ?? 'test-results/screens/identity-audit';
const WAIT = Number(process.env.SCREENS_WAIT ?? 900);
const MASTER = 'nemo-demo-tresor'; // gitleaks:allow (invented demo value)
const SCALE = (process.env.SCREENS_SCALE as 'small' | 'medium' | 'large' | undefined) ?? 'medium';
const ONLY = process.env.AUDIT_PARTS?.split(',');
const part = (name: string) => !ONLY || ONLY.includes(name);

const MODULES: { id: string; path: string; desktop?: boolean }[] = [
  { id: 'calendar', path: `/calendar?view=week&date=${SEED_TODAY}` },
  { id: 'todos', path: '/todos' },
  { id: 'habits', path: '/habits' },
  { id: 'timetrack', path: '/timetrack' },
  { id: 'weather', path: '/weather' },
  { id: 'people', path: '/people' },
  { id: 'maps', path: '/maps' },
  { id: 'finance', path: '/finance?tab=overview' },
  { id: 'invoices', path: '/invoices' },
  { id: 'subscriptions', path: '/subscriptions' },
  { id: 'budgets', path: '/budgets' },
  { id: 'lists', path: '/lists' },
  { id: 'pantry', path: '/pantry' },
  { id: 'bookmarks', path: '/bookmarks' },
  { id: 'feeds', path: '/feeds' },
  { id: 'notes', path: '/notes' },
  { id: 'chat', path: '/chat' },
  { id: 'browser', path: '/browser', desktop: true },
  { id: 'mail', path: '/mail', desktop: true },
  { id: 'music', path: '/music' },
  { id: 'vault', path: '/vault' },
  { id: 'disk', path: '/disk', desktop: true },
  { id: 'downloads', path: '/downloads', desktop: true },
];

/** Title text goes black (box over the text), icons stay: the module must be recognised by form, colour and content. */
const BLIND_CSS = `
[data-testid="module-frame"] h1,
[data-testid="module-frame"] p > span:last-child:not([aria-hidden]),
[data-testid="subnav"] a > span,
[data-testid^="widget-"] h2 a,
[data-testid^="widget-"] h2 { color: transparent !important; background: #000 !important; border-radius: 4px; }
[data-testid="module-frame"] h1 *, [data-testid^="widget-"] h2 * { color: transparent !important; }
[data-testid^="widget-"] h2 svg { display: none !important; }
`;

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

async function settle(page: Page, wait = WAIT) {
  await expect(page.locator('main')).toBeVisible();
  const notice = page.getByRole('button', { name: 'Schließen', exact: true });
  if (await notice.count()) await notice.first().click();
  await page.waitForTimeout(wait);
}

interface Vp {
  name: string;
  width: number;
  height: number;
  mobile?: boolean;
}
const DESKTOP: Vp = { name: '1920x1080', width: 1920, height: 1080 };
const PHONE: Vp = { name: '412x915', width: 412, height: 915, mobile: true };

async function newContext(
  browser: Parameters<Parameters<typeof test>[2]>[0]['browser'],
  vp: Vp,
  scheme: 'light' | 'dark',
  seed: boolean,
): Promise<{ context: BrowserContext; page: Page }> {
  const desktop = !vp.mobile;
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile ?? false,
    hasTouch: vp.mobile ?? false,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    colorScheme: scheme,
  });
  const page = await context.newPage();
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  await mockWeather(page);
  await page.addInitScript((isDesktop) => {
    localStorage.setItem('tm-show-preview', '1');
    if (isDesktop) localStorage.setItem('__tmPlatformKind', 'desktop');
  }, desktop);
  await bootDev(page);
  if (seed) await seedApp(page, SCALE);
  else {
    await page.goto('/');
    await settle(page);
  }
  await enableModules(
    page,
    seed
      ? ['chat', 'maps', 'music', ...(desktop ? ['disk', 'mail', 'browser', 'downloads'] : [])]
      : MODULES.filter((m) => desktop || !m.desktop)
          .map((m) => m.id)
          .concat(['accounts']),
  );
  if (seed) {
    await pickWeatherPlace(page);
    await mockSpotify(page);
    await seedConnected(page, ['show', 'control', 'playlists', 'library', 'history']);
  }
  return { context, page };
}

async function unlockVault(page: Page) {
  await page.goto('/accounts');
  await page.waitForTimeout(300);
  await page.getByLabel('Master-Passwort').fill(MASTER);
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('button', { name: 'Zugang hinzufügen' })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(WAIT);
}

test('identity audit: blind crops, empty states, toolbox, overview head', async ({ browser }) => {
  test.setTimeout(0);
  // ---- Blind test crops: desktop light + dark, phone light. Random names; the key is written at the end.
  if (part('blind')) {
    const key: Record<string, string> = {};
    const blindDir = `${OUT}/blind`;
    mkdirSync(blindDir, { recursive: true });
    const name = () => randomBytes(3).toString('hex');
    for (const [vp, scheme] of [
      [DESKTOP, 'light'],
      [DESKTOP, 'dark'],
      [PHONE, 'light'],
    ] as const) {
      const { context, page } = await newContext(browser, vp, scheme, true);
      const desktop = !vp.mobile;
      for (const m of MODULES) {
        if (m.desktop && !desktop) continue;
        await page.goto(m.path);
        await settle(page);
        await page.addStyleTag({ content: BLIND_CSS });
        await page.waitForTimeout(200);
        const frame = page.getByTestId('module-frame');
        if (await frame.count()) {
          const id = name();
          await frame.screenshot({ path: `${blindDir}/${id}.png` });
          key[id] = `head ${m.id} ${vp.name} ${scheme}`;
        }
      }
      if (desktop) {
        await unlockVault(page);
        await page.addStyleTag({ content: BLIND_CSS });
        await page.waitForTimeout(200);
        const id = name();
        await page.getByTestId('module-frame').screenshot({ path: `${blindDir}/${id}.png` });
        key[id] = `head accounts ${vp.name} ${scheme}`;
      }
      // Widgets: every widget ("Ausführlich").
      await page.evaluate(() => localStorage.setItem('tm-home-view', 'all'));
      await page.goto('/');
      await settle(page, WAIT * 3);
      await page.addStyleTag({ content: BLIND_CSS });
      await page.waitForTimeout(200);
      const items = page.locator('[data-testid^="widget-"]');
      const n = await items.count();
      for (let i = 0; i < n; i++) {
        const el = items.nth(i);
        if (!(await el.isVisible())) continue;
        const tid = (await el.getAttribute('data-testid')) ?? String(i);
        const id = name();
        await el.screenshot({ path: `${blindDir}/${id}.png` });
        key[id] = `widget ${tid.replace('widget-', '')} ${vp.name} ${scheme}`;
      }
      await page.evaluate(() => localStorage.removeItem('tm-home-view'));
      await context.close();
    }
    writeFileSync(`${OUT}/blind-key.json`, JSON.stringify(key, null, 2));
  }

  // ---- Empty states: no seed data. Every module page, the overview with its empty widgets.
  if (part('empty')) {
    for (const [vp, scheme] of [
      [DESKTOP, 'light'],
      [DESKTOP, 'dark'],
      [PHONE, 'light'],
    ] as const) {
      const dir = `${OUT}/empty/${scheme}`;
      mkdirSync(`${dir}/heads`, { recursive: true });
      mkdirSync(`${dir}/widgets`, { recursive: true });
      const { context, page } = await newContext(browser, vp, scheme, false);
      const desktop = !vp.mobile;
      for (const m of MODULES) {
        if (m.desktop && !desktop) continue;
        await page.goto(m.path);
        await settle(page);
        await page.screenshot({ path: `${dir}/${vp.name}--${m.id}.png` });
        const frame = page.getByTestId('module-frame');
        if (await frame.count())
          await frame.screenshot({ path: `${dir}/heads/${vp.name}--${m.id}.png` });
      }
      await page.goto('/accounts');
      await settle(page);
      await page.screenshot({ path: `${dir}/${vp.name}--accounts.png` });
      await page.evaluate(() => localStorage.setItem('tm-home-view', 'all'));
      await page.goto('/');
      await settle(page, WAIT * 3);
      await page.screenshot({ path: `${dir}/${vp.name}--dashboard.png`, fullPage: vp.mobile });
      const items = page.locator('[data-testid^="widget-"]');
      const n = await items.count();
      for (let i = 0; i < n; i++) {
        const el = items.nth(i);
        if (!(await el.isVisible())) continue;
        const tid = (await el.getAttribute('data-testid')) ?? String(i);
        await el.screenshot({
          path: `${dir}/widgets/${vp.name}--${tid.replace('widget-', '').replace(':', '-')}.png`,
        });
      }
      await context.close();
    }
  }

  // ---- Toolbox: the panel, three tools open; overview head crops.
  if (part('tools')) {
    for (const [vp, scheme] of [
      [DESKTOP, 'light'],
      [DESKTOP, 'dark'],
      [PHONE, 'light'],
    ] as const) {
      const dir = `${OUT}/tools/${scheme}`;
      mkdirSync(dir, { recursive: true });
      const { context, page } = await newContext(browser, vp, scheme, true);
      await page.goto('/');
      await settle(page, WAIT * 2);
      const head = page.getByTestId('overview-head');
      if (await head.count())
        await head.screenshot({ path: `${dir}/${vp.name}--overview-head.png` });
      const main = await page.locator('#main').boundingBox();
      if (main)
        await page.screenshot({
          path: `${dir}/${vp.name}--overview-top.png`,
          clip: {
            x: main.x,
            y: main.y,
            width: main.width,
            height: Math.min(700, vp.height - main.y),
          },
        });
      const dialog = await openToolbox(page);
      await page.waitForTimeout(WAIT);
      await page.screenshot({ path: `${dir}/${vp.name}--toolbox.png` });
      await dialog.screenshot({ path: `${dir}/${vp.name}--toolbox-panel.png` });
      for (const tool of ['Rechner', 'Timer & Stoppuhr', 'QR-Code']) {
        // Only tools that are on by default; the list entry's name may carry its shortcut, so match the start.
        const list = await openToolbox(page);
        await list
          .getByRole('button', {
            name: new RegExp(`^${tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
          })
          .last()
          .click({ timeout: 15_000 });
        const d = page.getByRole('dialog');
        await page.waitForTimeout(WAIT);
        await d.screenshot({
          path: `${dir}/${vp.name}--tool-${tool.replace(/[^a-z]+/gi, '-').toLowerCase()}.png`,
        });
      }
      await context.close();
    }
  }
});
