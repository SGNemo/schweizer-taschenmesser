import { expect, test } from '@playwright/test';
import { ready, showPreview } from './helpers';
import { mockSpotify, seedConnected } from './spotify-mock';

// Preview modules are listed only with "In Arbeit anzeigen" (maturity).
test.beforeEach(({ page }) => showPreview(page));

/** Sleep timer and keyboard shortcuts against a mocked Web API (invented names). */
test('the sleep timer shows when it pauses, survives a reload and ends with one tap', async ({
  page,
}) => {
  await mockSpotify(page);
  await seedConnected(page, ['show', 'control']);
  await ready(page, '/music');
  await page.getByRole('button', { name: 'Mehr zum Titel' }).click();
  await page.getByRole('menuitem', { name: 'In 30 Min. pausieren' }).click();
  const line = page.getByTestId('music-sleep');
  await expect(line).toContainText('Pausiert um');
  await page.reload();
  await expect(page.getByTestId('music-sleep')).toContainText('Pausiert um');
  await page.getByRole('button', { name: 'Schlaf-Timer aus' }).click();
  await expect(page.getByTestId('music-sleep')).toHaveCount(0);
});

test('Shift+↑ raises the volume by ten', async ({ page }) => {
  await mockSpotify(page);
  await seedConnected(page, ['show', 'control']);
  await ready(page, '/music');
  await expect(page.getByTestId('music-now')).toBeVisible();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  const volume = page.waitForRequest((r) => r.url().includes('/me/player/volume'));
  await page.keyboard.press('Shift+ArrowUp');
  expect(new URL((await volume).url()).searchParams.get('volume_percent')).toBe('50');
});
