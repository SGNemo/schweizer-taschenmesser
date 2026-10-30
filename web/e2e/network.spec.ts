import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

const isPhone = (info: { project: { name: string } }) => info.project.name === 'pixel-7';

/** Every request that leaves the app's own origin (localhost on other ports included). */
function watchExternal(page: Page): string[] {
  const external: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol === 'data:' || u.protocol === 'blob:') return;
    if (u.origin !== new URL(page.url() === 'about:blank' ? r.url() : page.url()).origin)
      external.push(r.url());
  });
  return external;
}

test('nothing leaves the app without a click: start, home, settings', async ({ page }) => {
  const external = watchExternal(page);
  await ready(page, '/');
  for (const path of ['/settings', '/settings/verbindungen', '/settings/ueber', '/settings/ki']) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
  }
  await page.waitForTimeout(2500);
  expect(external).toEqual([]);
});

async function openCurrency(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.getByRole('button', { name: 'Werkzeuge' }).click();
  const sheet = page.getByRole('dialog', { name: 'Werkzeuge' });
  await sheet.getByRole('button', { name: 'Währung' }).click();
  return sheet;
}

test('the connection log lists host and reason, the block stops requests before they leave', async ({
  page,
}, info) => {
  test.skip(isPhone(info), 'same code path as desktop; the tool sheet is covered there');
  let hits = 0;
  await page.route('https://api.frankfurter.dev/**', async (route) => {
    hits++;
    await route.fulfill({
      json: { amount: 1, base: 'EUR', date: '2026-09-29', rates: { USD: 1.1, CHF: 0.95 } },
    });
  });

  // Keep the list across the reload and block the network.
  await ready(page, '/settings/verbindungen');
  await page.getByRole('switch', { name: 'Liste auf diesem Gerät behalten' }).click();
  await page.getByRole('switch', { name: 'Netzwerk sperren' }).click();
  await expect(page.getByText('Das Netzwerk ist gesperrt. Es geht nichts raus.')).toBeVisible();

  await openCurrency(page);
  await page.waitForTimeout(800);
  expect(hits).toBe(0);

  await page.goto('/settings/verbindungen');
  const log = page.getByTestId('net-log');
  await expect(log).toContainText('api.frankfurter.dev');
  await expect(log).toContainText('Währungsrechner');
  await expect(log).toContainText('gesperrt');
  // Host only: no path, no query.
  await expect(log).not.toContainText('/v1/latest');

  // Allowed again: the request goes out and is listed with its answer.
  await page.getByRole('switch', { name: 'Netzwerk sperren' }).click();
  await openCurrency(page);
  await expect.poll(() => hits).toBe(1);
  await page.goto('/settings/verbindungen');
  await expect(page.getByTestId('net-log')).toContainText('Antwort 200');

  await page.getByRole('button', { name: 'Liste leeren' }).click();
  await expect(page.getByTestId('net-summary')).toContainText('keine Verbindung');
});
