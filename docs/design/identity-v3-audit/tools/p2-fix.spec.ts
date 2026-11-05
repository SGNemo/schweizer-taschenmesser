import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { bootDev, SEED_TODAY, seedApp } from '../seed/helpers';
import { mockSpotify, seedConnected } from '../spotify-mock';
import { mockWeather, pickWeatherPlace } from '../weather-mock';

/**
 * Package 2 capture (heads, widgets, empty pages, blind crops of the eleven modules); copy to web/e2e/screenshots/ and
 * web/ (config) like the audit spec, run with P2_RUNS=d-light,d-dark,p-light AUDIT_PARTS=heads,blind,empty.
 * Audit tooling (docs/design/identity-v3-audit): blind-test crops (title text blacked out, random file names, key
 * written last), empty states of every module and widget (no seed), the toolbox with three tools open, the overview
 * head. Not part of CI. Usage (web/, seeded preview on :4174):
 *   SCREENS_DIR=<dir> npx playwright test -c playwright.screens.config.ts identity-audit --project=seeded
 */
const OUT = process.env.SCREENS_DIR ?? 'test-results/screens/p2-fix';
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

/** Title text goes black (box over the text), icons go too: the module must be recognised by form and signature. */
const BLIND_CSS = `
[data-testid="module-frame"] h1,
[data-testid="module-frame"] p > span:last-child:not([aria-hidden]),
[data-testid="subnav"] a > span,
[data-testid^="widget-"] h2 a,
[data-testid^="widget-"] h2 { color: transparent !important; background: #000 !important; border-radius: 4px; }
[data-testid="module-frame"] h1 *, [data-testid^="widget-"] h2 * { color: transparent !important; }
[data-testid^="widget-"] h2 svg, [data-testid="module-frame"] p svg { display: none !important; }
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

const MINE = [
  'lists',
  'pantry',
  'vault',
  'bookmarks',
  'notes',
  'chat',
  'browser',
  'feeds',
  'mail',
  'music',
];
const WIDGETS =
  /^widget-(lists|pantry|vault|accounts|bookmarks|notes|chat|browser|feeds|mail|music):/;

test('package 2 shots: heads, widgets, empty pages', async ({ browser }) => {
  test.setTimeout(0);
  const runs = (process.env.P2_RUNS ?? 'd-light,d-dark,p-light').split(',');
  for (const run of runs) {
    const [k, scheme] = run.split('-') as ['d' | 'p', 'light' | 'dark'];
    const vp = k === 'd' ? DESKTOP : PHONE;
    const desktop = !vp.mobile;
    if (part('heads')) {
      const dir = `${OUT}/${vp.name}-${scheme}`;
      mkdirSync(dir, { recursive: true });
      const { context, page } = await newContext(browser, vp, scheme, true);
      for (const m of MODULES.filter((x) => MINE.includes(x.id))) {
        if (m.desktop && !desktop) continue;
        await page.goto(m.path);
        await settle(page);
        const frame = page.getByTestId('module-frame');
        if (await frame.count()) await frame.screenshot({ path: `${dir}/head-${m.id}.png` });
        await page.screenshot({ path: `${dir}/page-${m.id}.png` });
      }
      await unlockVault(page);
      await page.getByTestId('module-frame').screenshot({ path: `${dir}/head-accounts.png` });
      await page.screenshot({ path: `${dir}/page-accounts.png` });
      await page.evaluate(() => localStorage.setItem('tm-home-view', 'all'));
      await page.goto('/');
      await settle(page, WAIT * 3);
      await page.screenshot({ path: `${dir}/overview.png`, fullPage: true });
      const items = page.locator('[data-testid^="widget-"]');
      const n = await items.count();
      for (let i = 0; i < n; i++) {
        const el = items.nth(i);
        const tid = (await el.getAttribute('data-testid')) ?? '';
        if (!WIDGETS.test(tid) || !(await el.isVisible())) continue;
        await el.screenshot({
          path: `${dir}/widget-${tid.replace('widget-', '').replace(':', '-')}.png`,
        });
      }
      await context.close();
    }
    if (part('blind')) {
      const dir = `${OUT}/blind`;
      mkdirSync(dir, { recursive: true });
      const key: Record<string, string> = {};
      const name = () => randomBytes(3).toString('hex');
      const { context, page } = await newContext(browser, vp, scheme, true);
      for (const m of MODULES.filter((x) => MINE.includes(x.id))) {
        if (m.desktop && !desktop) continue;
        await page.goto(m.path);
        await settle(page);
        await page.addStyleTag({ content: BLIND_CSS });
        const id = name();
        await page.getByTestId('module-frame').screenshot({ path: `${dir}/${id}.png` });
        key[id] = `head ${m.id} ${run}`;
      }
      await page.evaluate(() => localStorage.setItem('tm-home-view', 'all'));
      await page.goto('/');
      await settle(page, WAIT * 3);
      await page.addStyleTag({ content: BLIND_CSS });
      const items = page.locator('[data-testid^="widget-"]');
      const n = await items.count();
      for (let i = 0; i < n; i++) {
        const el = items.nth(i);
        const tid = (await el.getAttribute('data-testid')) ?? '';
        if (!WIDGETS.test(tid) || !(await el.isVisible())) continue;
        const id = name();
        await el.screenshot({ path: `${dir}/${id}.png` });
        key[id] = `widget ${tid.replace('widget-', '')} ${run}`;
      }
      await context.close();
      writeFileSync(`${OUT}/blind-key-${run}.json`, JSON.stringify(key, null, 2));
    }
    if (part('empty')) {
      const dir = `${OUT}/${vp.name}-${scheme}/empty`;
      mkdirSync(dir, { recursive: true });
      const { context, page } = await newContext(browser, vp, scheme, false);
      for (const m of MODULES.filter((x) => MINE.includes(x.id))) {
        if (m.desktop && !desktop) continue;
        await page.goto(m.path);
        await settle(page);
        await page.screenshot({ path: `${dir}/page-${m.id}.png` });
      }
      await page.goto('/accounts');
      await settle(page);
      await page.screenshot({ path: `${dir}/page-accounts.png` });
      await page.evaluate(() => localStorage.setItem('tm-home-view', 'all'));
      await page.goto('/');
      await settle(page, WAIT * 3);
      const items = page.locator('[data-testid^="widget-"]');
      const n = await items.count();
      for (let i = 0; i < n; i++) {
        const el = items.nth(i);
        const tid = (await el.getAttribute('data-testid')) ?? '';
        if (!WIDGETS.test(tid) || !(await el.isVisible())) continue;
        await el.screenshot({
          path: `${dir}/widget-${tid.replace('widget-', '').replace(':', '-')}.png`,
        });
      }
      await context.close();
    }
  }
});
