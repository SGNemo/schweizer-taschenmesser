import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-03T10:00:00'));
});

async function add(page: Page, title: string) {
  await page.locator('[data-page-action]').or(page.getByTestId('bottom-plus')).first().click();
  await page.getByRole('dialog').getByLabel('Titel').fill(title);
  await page.getByRole('dialog').getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
}

test.describe('ToDos: views and board (plan group)', () => {
  test('a new task without a date is under Irgendwann and moves to Heute on the board', async ({
    page,
  }) => {
    await ready(page, '/todos');
    await add(page, 'Regal aufbauen');

    await page.getByRole('button', { name: 'Irgendwann', exact: true }).click();
    await expect(page.getByText('Regal aufbauen', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Board', exact: true }).click();
    const someday = page.getByRole('region', { name: 'Irgendwann' });
    await expect(someday.getByText('Regal aufbauen')).toBeVisible();
    await someday.getByRole('button', { name: 'Weitere Optionen' }).click();
    await page.getByRole('menuitem', { name: 'Verschieben nach Heute' }).click();
    await expect(
      page.getByRole('region', { name: 'Heute' }).getByText('Regal aufbauen'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeVisible();
  });
});
