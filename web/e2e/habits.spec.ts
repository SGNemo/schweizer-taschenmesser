import { expect, test } from '@playwright/test';
import { enable } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-03T10:00:00'));
});

test.describe('Habits (plan group, new module)', () => {
  test('the water habit from the template: +1 counts a glass, the reminder window is set', async ({
    page,
  }) => {
    await enable(page, 'habits');
    await page.goto('/habits?new=1');
    const dialog = page.getByRole('dialog', { name: 'Gewohnheit eintragen' });
    await dialog.getByRole('button', { name: 'Wasser trinken' }).click();
    await expect(dialog.getByLabel('Erinnerung')).toHaveValue('window');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const card = page.getByTestId('habit-card');
    await expect(card.getByText('0 von 8 Gläser')).toBeVisible();
    await card.getByRole('button', { name: '+1 Wasser trinken' }).click();
    await card.getByRole('button', { name: '+1 Wasser trinken' }).click();
    await expect(card.getByText('2 von 8 Gläser')).toBeVisible();
    // The rings row under the head is gone (0b-4b): the row itself names the goal in text, not only by its ring.
    await expect(card).toContainText('Wasser trinken');
    await expect(page.getByTestId('habit-rings')).toHaveCount(0);
  });

  test('the history view shows the year grid with a legend in words', async ({ page }) => {
    await enable(page, 'habits');
    await page.goto('/habits?new=1');
    await page.getByRole('dialog').getByRole('button', { name: 'Dehnen' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
    await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
    await expect(
      page.getByRole('img', { name: 'Das letzte Jahr, eine Spalte pro Woche' }),
    ).toBeVisible();
    for (const word of ['Geschafft', 'Teilweise', 'Offen', 'Pausentag'])
      await expect(page.getByRole('list').getByText(word, { exact: true }).first()).toBeVisible();
  });

  test('the old path no longer leads away from the module', async ({ page }) => {
    await enable(page, 'habits');
    await page.goto('/habits');
    await expect(page).toHaveURL(/\/habits$/);
    await expect(page.locator('main h1')).toHaveText('Gewohnheiten');
  });
});
