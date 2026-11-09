import { expect, test, type Page } from '@playwright/test';
import { enable, showAllWidgets, showPreview } from './helpers';

/**
 * Uhr (preview module): add a place offline, see it on the overview with its offset, rename it, open the module from
 * the clock next to the logo, and no horizontal overflow on a 412 px phone.
 */
test.use({ timezoneId: 'Europe/Berlin' });

test.beforeEach(async ({ page }) => {
  // 22:30 in Berlin in winter: 06:30 tomorrow in Tokyo (+8 h), 16:30 today in New York (−6 h).
  await page.clock.setFixedTime(new Date('2026-01-15T22:30:00+01:00'));
  await showPreview(page);
  await showAllWidgets(page);
});

async function addPlace(page: Page, query: string, hit: string) {
  await page.goto('/clock?new=1');
  const dialog = page.getByRole('dialog', { name: 'Ort hinzufügen' });
  await dialog.getByLabel('Stadt oder Zeitzone').fill(query);
  await dialog.getByTestId('clock-hit').filter({ hasText: hit }).first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('a place added by search shows on the page and on the overview with its offset', async ({
  page,
}) => {
  await enable(page, 'clock');
  // A typo still finds Tokyo: the search is offline and forgiving.
  await addPlace(page, 'Tokoi', 'Tokio');
  const row = page.getByTestId('clock-place').filter({ hasText: 'Tokio' });
  await expect(row).toContainText('06:30');
  await expect(row).toContainText('morgen · +8 h');
  await expect(row).toContainText('Tag');
  await expect(row).toContainText('Asia/Tokyo');
  await expect(page.getByTestId('clock-here')).toHaveText('22:30');

  await page.goto('/');
  const tile = page.getByTestId('widget-clock:places');
  await expect(tile).toContainText('Tokio');
  await expect(tile).toContainText('06:30');
  await expect(tile).toContainText('Tag · morgen · +8 h');
});

test('a place gets its own name; removing it can be undone', async ({ page }) => {
  await enable(page, 'clock');
  await addPlace(page, 'New York', 'New York');
  const row = page.getByTestId('clock-place');
  await expect(row).toContainText('16:30');
  await expect(row).toContainText('−6 h');

  await row.getByRole('button', { name: 'Aktionen für New York' }).click();
  await page.getByRole('menuitem', { name: 'Umbenennen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ort umbenennen' });
  await dialog.getByLabel('Name').fill('Tante Ines');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(row).toContainText('Tante Ines');

  await row.getByRole('button', { name: 'Aktionen für Tante Ines' }).click();
  await page.getByRole('menuitem', { name: /Entfernen/ }).click();
  await expect(page.getByTestId('clock-empty')).toBeVisible();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByTestId('clock-place')).toContainText('Tante Ines');
});

test('the clock next to the logo opens the module while it is on', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => localStorage.setItem('tm-clock', '1'));
  await page.goto('/');
  // Module off: the time is no link.
  await expect(page.getByTestId('sidebar').getByTestId('logo-clock')).toBeVisible();
  await expect(page.getByTestId('logo-clock-link')).toHaveCount(0);
  await enable(page, 'clock');
  await page.goto('/');
  const link = page.getByTestId('sidebar').getByTestId('logo-clock-link');
  await expect(link).toHaveAccessibleName('Uhr öffnen, 22:30');
  await link.click();
  await expect(page).toHaveURL(/\/clock$/);
  await expect(page.locator('main h1')).toHaveText('Uhr');
});

test.describe('phone (412 px)', () => {
  test.use({ viewport: { width: 412, height: 915 } });

  test('long names and many places fit without horizontal overflow', async ({ page }) => {
    await enable(page, 'clock');
    await addPlace(page, 'Kapstadt', 'Kapstadt');
    await addPlace(page, 'Asia/Kolkata', 'Kolkata');
    const row = page.getByTestId('clock-place').first();
    await row.getByRole('button', { name: /Aktionen für/ }).click();
    await page.getByRole('menuitem', { name: 'Umbenennen' }).click();
    await page
      .getByRole('dialog')
      .getByLabel('Name')
      .fill('Ferienwohnung der Familie am Kap der Guten Hoffnung');
    await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByTestId('clock-place')).toHaveCount(2);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    for (const r of await page.getByTestId('clock-place').all()) {
      const box = (await r.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(412);
    }
    await page.goto('/');
    const tile = page.getByTestId('widget-clock:places');
    await expect(tile).toContainText('+4:30 h');
    const width = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(width).toBeLessThanOrEqual(0);
  });
});
