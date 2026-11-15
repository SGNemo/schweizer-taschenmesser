import { expect, test, type Page } from '@playwright/test';
import { backSettled, enable, moreFields, showPreview } from './helpers';
import { openPageMenu } from './money-helpers';

/**
 * Planner hub S3: a list is ONE thing of the plan („In den Plan“ in the list's ⋯ menu), and what the pantry sends
 * to the shopping list keeps the way back. The planner checks use texts only – nothing here depends on the planner
 * page's layout.
 */

/** Deterministic "today": Monday 2026-11-09, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-09T10:00:00'));
  await showPreview(page);
});

async function open(page: Page, url: string) {
  await backSettled(page);
  await page.goto(url);
  await expect(page.locator('main h1')).toBeVisible();
}

async function addEntry(page: Page, text: string, name: string) {
  const input = page.getByLabel('Eintrag hinzufügen');
  await input.fill(text);
  await input.press('Enter');
  await expect(page.getByRole('checkbox', { name })).toBeVisible();
}

test('„In den Plan“ on the shopping list: one row in the planner, then „Im Plan · Mo“', async ({
  page,
}) => {
  test.slow(); // three modules switched on and five page loads
  await enable(page, 'lists');
  await open(page, '/lists');
  await addEntry(page, '2 Milch', 'Milch');
  await addEntry(page, 'Brot', 'Brot');
  // The planner is off: the list offers nothing.
  let menu = await openPageMenu(page);
  await expect(menu.getByRole('menuitem', { name: 'In den Plan' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await enable(page, 'todos');
  await enable(page, 'planner');
  await open(page, '/lists');
  menu = await openPageMenu(page);
  await menu.getByRole('menuitem', { name: 'In den Plan' }).click();
  await expect(page.getByText('Im Plan: Einkaufen · 2 Dinge · Mo')).toBeVisible();

  // One thing for the whole list: its title carries the count, no entry of the list is a row.
  await open(page, '/planner');
  await expect(page.getByText('Einkaufen · 2 Dinge').first()).toBeVisible();
  await expect(page.locator('main').getByText('Milch')).toHaveCount(0);
  await expect(page.locator('main').getByText('Brot')).toHaveCount(0);

  // Back on the list the entry says where it stands; no ToDo was made for it.
  await open(page, '/lists');
  menu = await openPageMenu(page);
  await expect(menu.getByRole('menuitem', { name: 'Im Plan · Mo' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'In den Plan' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await open(page, '/todos');
  await expect(page.locator('main').getByText(/Einkauf/)).toHaveCount(0);

  // Everything bought: the row leaves the plan by itself.
  await open(page, '/lists');
  for (const name of ['Milch', 'Brot']) {
    const box = page.getByRole('checkbox', { name });
    await box.click();
    await expect(box).toBeChecked();
  }
  await open(page, '/planner');
  await expect(page.getByText(/Einkaufen · \d/)).toHaveCount(0);

  // The request still stands (the next entry would bring the list back): the emptied list says so and ends it.
  await open(page, '/lists');
  menu = await openPageMenu(page);
  await menu.getByRole('menuitem', { name: 'Nicht mehr planen' }).click();
  await expect(page.getByText(/Nicht im Plan/).first()).toBeVisible();
  menu = await openPageMenu(page);
  await expect(menu.getByRole('menuitem', { name: 'Nicht mehr planen' })).toHaveCount(0);
  await page.keyboard.press('Escape');
});

test('pantry → shopping list: „Auf der Einkaufsliste“, the cart leads to the entry, the entry leads back', async ({
  page,
}) => {
  await enable(page, 'pantry');
  await enable(page, 'lists');
  await open(page, '/pantry');
  await page
    .getByRole('button', { name: /Vorrat (hinzufügen|eintragen)/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: 'Vorrat eintragen' });
  await dialog.getByLabel('Name', { exact: true }).fill('Milch');
  await dialog.getByLabel('Vorrat (Anzahl)').fill('1');
  await moreFields(page);
  await dialog.getByLabel('Nachkaufen ab (Anzahl, optional)').fill('2');
  await dialog.getByRole('button', { name: /^(Speichern|.+ eintragen)$/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const tile = page.locator('#pantry-place-pantry li').filter({ hasText: 'Milch' });
  await expect(tile.getByText('Wird knapp')).toBeVisible();
  await tile.getByRole('button', { name: 'Auf die Einkaufsliste: Milch' }).click();
  await expect(tile.getByText('Auf der Einkaufsliste')).toBeVisible();
  await expect(tile.getByText('Wird knapp')).toHaveCount(0);

  // The same button is now the way to the list.
  await tile.getByRole('button', { name: 'Zur Einkaufsliste: Milch' }).click();
  await expect(page).toHaveURL(/\/lists/);
  await expect(page.getByRole('checkbox', { name: 'Milch' })).toBeVisible();

  // …and the entry leads back to the pantry entry.
  await page.getByRole('button', { name: 'Eintrag bearbeiten' }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Aus den Vorräten: Milch' }).click();
  await expect(page).toHaveURL(/\/pantry/);
  await expect(page.getByRole('dialog', { name: /Vorrat/ })).toBeVisible();
});
