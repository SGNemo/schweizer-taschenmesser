import { expect, test, type Page } from '@playwright/test';
import { enable, moreFields, showAllWidgets } from './helpers';

test.beforeEach(async ({ page }) => {
  await showAllWidgets(page);
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function addItem(page: Page, name: string, count: string, min: string) {
  await page.getByRole('button', { name: 'Vorrat hinzufügen' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Vorrat hinzufügen' });
  await dialog.getByLabel('Name', { exact: true }).fill(name);
  await dialog.getByLabel('Vorrat (Anzahl)').fill(count);
  await moreFields(page);
  await dialog.getByLabel('Nachkaufen ab (Anzahl, optional)').fill(min);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('everything that runs low goes to the shopping list with one click; the home widget shows it', async ({
  page,
}) => {
  await enable(page, 'pantry');
  await enable(page, 'lists');
  await page.goto('/pantry');
  await addItem(page, 'Milch', '1', '2');
  await addItem(page, 'Eier', '2', '4');
  await addItem(page, 'Salz', '5', '1'); // enough

  // Tiles of one band: equally tall, the same end column (cart slot kept when not needed), and
  // the stepper is one labelled group whose minus is an icon like its plus (round 6, S01).
  const tiles = page.locator('#pantry-place-pantry li');
  await expect(tiles).toHaveCount(3);
  const boxes = await Promise.all([0, 1, 2].map(async (n) => (await tiles.nth(n).boundingBox())!));
  const sameBand = boxes.filter((b) => Math.abs(b.y - boxes[0]!.y) < 2);
  for (const b of sameBand) expect(Math.abs(b.height - sameBand[0]!.height)).toBeLessThanOrEqual(2);
  const salz = tiles.filter({ hasText: 'Salz' });
  const milch = tiles.filter({ hasText: 'Milch' });
  // The stepper sits the same distance from the tile's end, cart or not.
  const inset = async (tile: typeof salz) => {
    const box = (await tile.boundingBox())!;
    const group = (await tile.getByRole('group', { name: 'Anzahl' }).boundingBox())!;
    return box.x + box.width - group.x;
  };
  expect(Math.abs((await inset(salz)) - (await inset(milch)))).toBeLessThanOrEqual(1);
  const stepper = salz.getByRole('group', { name: 'Anzahl' });
  await expect(stepper).toContainText('5');
  await expect(
    stepper.getByRole('button', { name: 'Salz: einer weniger' }).locator('svg'),
  ).toHaveCount(1);
  await expect(
    stepper.getByRole('button', { name: 'Salz: einer mehr' }).locator('svg'),
  ).toHaveCount(1);
  await expect(milch.getByText('Wird knapp')).toBeVisible();

  // "Alle n nachkaufen" lives in the page's ⋯ menu; the toolbar keeps one primary action.
  await expect(page.getByRole('button', { name: 'Alle 2 nachkaufen' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Weitere Aktionen', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Alle 2 nachkaufen' }).click(); // 2 clicks
  await expect(page.getByText('2 Dinge an die Einkaufsliste gesendet.')).toBeVisible();

  await page.goto('/lists');
  await expect(page.getByRole('listitem').filter({ hasText: 'Milch' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Eier' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Salz' })).toHaveCount(0);

  await page.goto('/');
  const widget = page.getByTestId('widget-pantry:expiring');
  await expect(widget).toContainText('Milch');
  await expect(widget).toContainText('Wird knapp');
  await expect(widget).toContainText('2 wenig');
});
