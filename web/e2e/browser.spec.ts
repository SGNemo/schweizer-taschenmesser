import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Browser module against the fake tabs of `core/platform/fakeBrowser.ts` (E2E builds only): no page
 * is loaded, the fake answers navigations with events and records the calls on `__tmBrowserCalls`.
 */

async function asDesktop(page: Page) {
  await page.addInitScript(() => localStorage.setItem('__tmPlatformKind', 'desktop'));
}

async function enableBrowser(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          tx.objectStore('_modules').put({
            id: 'browser',
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
  );
}

const calls = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __tmBrowserCalls?: string[] }).__tmBrowserCalls ?? [],
  );

const menu = (page: Page) => page.locator('main').getByRole('button', { name: 'Mehr' });

async function go(page: Page, text: string) {
  const address = page.getByLabel('Adresse oder Suchbegriff');
  await address.fill(text);
  await address.press('Enter');
}

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.help}`),
    label,
  ).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await asDesktop(page);
  await enableBrowser(page);
  await page.goto('/browser');
  await expect(page.getByLabel('Adresse oder Suchbegriff')).toBeVisible();
});

test('start page is accessible; an address opens a tab, a search term searches', async ({
  page,
}) => {
  await expect(page.getByText('Wohin soll es gehen?')).toBeVisible();
  await expect(page.getByText('Kein vollwertiger Browser')).toBeVisible();
  await audit(page, 'start page');
  await page.getByRole('button', { name: 'Neuer Tab' }).click();
  await go(page, 'example.org');
  await expect(page.getByRole('button', { name: /Testseite example\.org/ })).toBeVisible();
  expect(await calls(page)).toContain('open:1:normal:https://example.org/');
  await go(page, 'wetter in bern');
  expect((await calls(page)).some((c) => c.includes('duckduckgo.com/?q=wetter%20in%20bern'))).toBe(
    true,
  );
});

test('a tab that cannot open shows why, hides the webview, and other modules still load', async ({
  page,
}) => {
  await go(page, 'https://fail-test.example.org/');
  const failed = page.getByTestId('browser-failed');
  await expect(failed).toContainText('Seite konnte nicht geladen werden');
  await expect(failed.getByRole('button', { name: 'Im Systembrowser öffnen' })).toBeVisible();
  await expect(failed.getByRole('button', { name: 'Noch einmal versuchen' })).toBeVisible();
  await expect(page.getByLabel('Adresse oder Suchbegriff')).toHaveValue(
    'https://fail-test.example.org/',
  );
  await audit(page, 'open failed');
  // The failed webview is closed again; nothing is left on top of the content.
  expect(await calls(page)).toContain('close:1');
  // Route change inside the app (no reload): the page leaves, the tabs are hidden, ToDos load.
  const hidden = async () => (await calls(page)).filter((c) => c === 'show:null').length;
  const before = await hidden();
  await page.evaluate(() => {
    history.pushState({}, '', '/todos');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.locator('main h1')).toHaveText(/ToDos/);
  await expect(page.getByTestId('browser-failed')).toHaveCount(0);
  expect(await hidden()).toBeGreaterThan(before);
});

test('a tab whose opening never answers does not hold up other modules', async ({ page }) => {
  // UI state only: the fake's promise stays open; a blocked main thread of the desktop app is a hand test.
  await go(page, 'https://hang-test.example.org/');
  expect(await calls(page)).toContain('open:1:normal:https://hang-test.example.org/');
  await page.evaluate(() => {
    history.pushState({}, '', '/todos');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.locator('main h1')).toHaveText(/ToDos/);
  await expect(page.getByTestId('page-loading-card')).toHaveCount(0);
});

test('plain HTTP is held back until the user confirms', async ({ page }) => {
  await go(page, 'http://example.org/');
  await expect(page.getByText('Diese Seite ist nicht verschlüsselt')).toBeVisible();
  await audit(page, 'http warning');
  await page.getByRole('button', { name: 'Trotzdem öffnen' }).click();
  await expect(page.getByRole('button', { name: /Testseite example\.org/ })).toBeVisible();
  expect(await calls(page)).toContain('navigate:1:http://example.org/:allowHttp');
});

test('bookmark star saves the page and the list opens it again', async ({ page }) => {
  await go(page, 'https://example.org/a');
  await page.getByRole('button', { name: 'Lesezeichen setzen' }).click();
  await menu(page).click();
  await page.getByRole('button', { name: 'Lesezeichen', exact: true }).click();
  await expect(page.getByText('example.org/a')).toBeVisible();
  await audit(page, 'bookmarks');
});

test('private tab opens without stored data and leaves no history', async ({ page }) => {
  await menu(page).click();
  await page.getByRole('button', { name: 'Neuer privater Tab' }).click();
  await go(page, 'example.org');
  expect(await calls(page)).toContain('open:1:private:https://example.org/');
  await menu(page).click();
  await page.getByRole('button', { name: 'Verlauf' }).click();
  await expect(page.getByText('Noch kein Verlauf.')).toBeVisible();
});

test('blocker panel lists third-party servers and saves an own rule', async ({ page }) => {
  await go(page, 'https://example.org/ads-test');
  await menu(page).click();
  await page.getByRole('button', { name: /Blocker/ }).click();
  await expect(page.getByText('1 Anfrage blockiert')).toBeVisible();
  await expect(page.getByText('cdn.thirdparty.test')).toBeVisible();
  await page.getByRole('button', { name: 'Blocken' }).click();
  await expect(page.getByRole('list', { name: 'Eigene Regeln' })).toContainText(
    'cdn.thirdparty.test',
  );
  await audit(page, 'blocker');
});

test('the tab strip carries the module hue; the tab overview lists every tab as a card', async ({
  page,
}) => {
  await expect(page.getByTestId('tab-strip')).toBeVisible();
  await page.getByRole('button', { name: 'Neuer Tab' }).click();
  await go(page, 'example.org');
  await expect(page.getByRole('button', { name: /Testseite example\.org/ })).toBeVisible();
  await page.getByRole('button', { name: 'Alle Tabs anzeigen' }).click();
  await expect(page.getByRole('heading', { name: 'Offene Tabs' })).toBeVisible();
  await expect(page.getByTestId('tab-card')).toHaveCount(1);
  await audit(page, 'tab overview');
  await page
    .getByTestId('tab-card')
    .getByRole('button', { name: /^Testseite example\.org/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Offene Tabs' })).toHaveCount(0);
});

test('a saved page shows as a tile on the start page; reader mode is offered for https pages', async ({
  page,
}) => {
  await go(page, 'https://example.org/a');
  await page.getByRole('button', { name: 'Lesezeichen setzen' }).click();
  await page.getByRole('button', { name: 'Neuer Tab' }).click();
  await expect(page.getByRole('list', { name: 'Lesezeichen' }).getByRole('button')).toHaveCount(1);
  await go(page, 'https://example.org/b');
  await menu(page).click();
  await expect(page.getByRole('button', { name: 'Lesemodus' })).toBeVisible();
});
