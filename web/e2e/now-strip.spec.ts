import { expect, test, type Page } from '@playwright/test';
import { enable, moreFields, openMoreFocus, ready } from './helpers';

/** The slim "Jetzt" row on module pages (comfort review, package 7). */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function addLowItem(page: Page) {
  await page.getByRole('button', { name: 'Vorrat hinzufügen' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Vorrat hinzufügen' });
  await dialog.getByLabel('Name', { exact: true }).fill('Milch');
  await dialog.getByLabel('Vorrat (Anzahl)').fill('1');
  await moreFields(page);
  await dialog.getByLabel('Nachkaufen ab (Anzahl, optional)').fill('2');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('the pantry page says what runs low; the switch in the settings hides the row', async ({
  page,
}) => {
  await enable(page, 'pantry');
  // The strips are off by default (calm defaults): switch them on first.
  await ready(page, '/settings/darstellung');
  await openMoreFocus(page);
  const toggle = page
    .locator('section[aria-labelledby="focus"]')
    .getByRole('switch', { name: '„Jetzt“ auf Modulseiten' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await page.goto('/pantry');
  await expect(page.getByTestId('now-strip')).toHaveCount(0); // nothing up, nothing shown
  await addLowItem(page);
  await expect(page.getByTestId('now-strip')).toContainText('1 Vorrat geht zur Neige');

  await ready(page, '/settings/darstellung');
  await openMoreFocus(page);
  // The switch shows the default (off) until the stored value is loaded: wait for "on" before
  // clicking, or the click lands on the stale default and writes "on" again.
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  await ready(page, '/pantry');
  await expect(page.getByRole('button', { name: /Milch/ }).first()).toBeVisible();
  await expect(page.getByTestId('now-strip')).toHaveCount(0);
});
