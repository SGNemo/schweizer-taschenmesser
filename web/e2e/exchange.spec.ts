import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { showPreview } from './helpers';

/**
 * Device exchange („Austausch“) against the fake shell of `core/platform/fakeExchange.ts` (E2E
 * builds only): no network. The fake PC has one paired phone „Pixel 7“, the fake phone its PC;
 * `window.__exchangeFake` lets something arrive or the PC end a session.
 */

async function enable(page: Page, kind: 'desktop' | 'android') {
  await page.addInitScript((k) => localStorage.setItem('__tmPlatformKind', k), kind);
  await showPreview(page);
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
            id: 'exchange',
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
  // the module's background work starts with the app
  await page.reload();
}

const fake = (page: Page, call: string, ...args: unknown[]) =>
  page.evaluate(
    ([c, a]) => {
      const hooks = (
        window as unknown as { __exchangeFake: Record<string, (...x: unknown[]) => void> }
      ).__exchangeFake;
      hooks[c as string]!(...(a as unknown[]));
    },
    [call, args] as const,
  );

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.help}`),
    label,
  ).toEqual([]);
}

test('PC: switched on once for the one paired phone, a link goes out and a note comes in', async ({
  page,
}) => {
  await enable(page, 'desktop');
  await page.goto('/exchange');
  await expect(page.getByRole('heading', { name: 'Austausch einschalten' })).toBeVisible();
  // the only paired device is preselected
  await expect(page.getByRole('checkbox', { name: /Pixel 7/ })).toBeChecked();
  await audit(page, 'first run');
  await page.getByRole('button', { name: 'Austausch einschalten' }).click();

  await expect(page.getByText(/Pixel 7 · erreichbar/)).toBeVisible();
  await expect(
    page.getByText('Noch nichts hier. Schick dir eine Notiz oder einen Link.'),
  ).toBeVisible();
  await page.getByLabel('Nachricht oder Link').fill('https://example.org/rezept');
  await page.getByRole('button', { name: 'Senden' }).click();
  const sent = page.getByRole('listitem').filter({ hasText: 'example.org' });
  await expect(sent).toContainText('von dir · Link');
  await expect(sent).toContainText('Angekommen', { timeout: 10_000 });

  await fake(page, 'arrive', 'text', 'Vergiss nicht, Milch zu kaufen');
  const got = page.getByRole('listitem').filter({ hasText: 'Milch' });
  await expect(got).toContainText('vom Handy · Notiz');
  await expect(got.getByRole('button', { name: 'Kopieren' })).toBeVisible();
  await expect(page.getByText('Karten bleiben 30 Tage, je Gerät die neuesten 1000.')).toBeVisible();
  await audit(page, 'conversation');

  // the off switch per device: pausing never asks, resuming does (the fake says yes)
  await page.getByRole('button', { name: 'Pausieren' }).click();
  await expect(page.getByText('Pixel 7 · Für dieses Gerät pausiert.')).toBeVisible();
  await page.getByRole('button', { name: 'Fortsetzen' }).click();
  await expect(page.getByText(/Pixel 7 · erreichbar/)).toBeVisible();
});

test('phone: a note goes to the PC, and a pause at the PC is said calmly', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enable(page, 'android');
  await page.goto('/exchange');
  await page.getByLabel('Nachricht oder Link').fill('Zeile eins\nZeile zwei');
  await page.getByRole('button', { name: 'Senden' }).click();
  const sent = page.getByRole('listitem').filter({ hasText: 'Zeile eins' });
  await expect(sent).toContainText('Angekommen', { timeout: 10_000 });
  await fake(page, 'arrive', 'link', 'https://example.org/fahrplan');
  await expect(page.getByRole('listitem').filter({ hasText: 'example.org' })).toContainText(
    'vom PC · Link',
  );
  await fake(page, 'closeSession', 'paused', null);
  await expect(
    page.getByText('Austausch ist am PC pausiert. Am PC: Austausch → Fortsetzen.'),
  ).toBeVisible();
  await audit(page, 'phone');
});
