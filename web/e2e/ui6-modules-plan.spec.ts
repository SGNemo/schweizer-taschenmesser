import { expect, test, type Page } from '@playwright/test';
import { enable, ready } from './helpers';

/** UI round 6 (docs/qa/round-6), branch fix/ui6-modules-plan: the findings that only a real layout shows. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function addTodo(page: Page, title: string) {
  await page.getByLabel('ToDo hinzufügen').fill(title);
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: title })).toBeVisible();
}

async function editTodo(
  page: Page,
  title: string,
  edit: (dialog: ReturnType<Page['getByRole']>) => Promise<void>,
) {
  await page.getByRole('button', { name: new RegExp(`^${title}`) }).click();
  const dialog = page.getByRole('dialog');
  await edit(dialog);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Text decoration and colour of a row title next to the given checkbox. */
const titleLook = (page: Page, name: string) =>
  page
    .getByRole('checkbox', { name, exact: true })
    .locator('xpath=ancestor::li[1]')
    .locator('[data-row]')
    .first()
    .locator(':scope > :first-child')
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return { line: s.textDecorationLine };
    });

test('U02: an open subtask under a done parent is not struck through', async ({ page }) => {
  await ready(page, '/todos');
  await addTodo(page, 'Vorräte prüfen');
  await editTodo(page, 'Vorräte prüfen', async (dialog) => {
    await dialog.getByLabel('Unteraufgabe hinzufügen').fill('Schritt 2');
    await dialog.getByLabel('Unteraufgabe hinzufügen').press('Enter');
    await expect(dialog.getByRole('checkbox', { name: 'Schritt 2' })).toBeVisible();
  });
  await page.getByRole('checkbox', { name: 'Vorräte prüfen', exact: true }).click();
  await page.getByRole('button', { name: 'Erledigt', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Schritt 2' })).not.toBeChecked();
  expect((await titleLook(page, 'Vorräte prüfen')).line).toBe('line-through');
  expect((await titleLook(page, 'Schritt 2')).line).toBe('none');
});

test('U21: on the phone a waiting row gives its width to the title; "Auf heute" is in the menu', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'pixel-7', 'phone layout');
  await ready(page, '/todos');
  await addTodo(page, 'Alte Sache mit einem langen Titel');
  await editTodo(page, 'Alte Sache', (dialog) => dialog.getByLabel('Fällig am').fill('2026-09-01'));
  const group = page.locator('[data-group="overdue"]');
  await expect(group).toHaveCount(1);
  await expect(group.getByRole('button', { name: 'Auf heute', exact: true })).toBeHidden();
  const width = await group
    .getByRole('button', { name: /^Alte Sache/ })
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeGreaterThanOrEqual(260);

  await group.getByRole('button', { name: 'Weitere Aktionen' }).click();
  await page.getByRole('menuitem', { name: 'Auf heute', exact: true }).click();
  await expect(page.locator('[data-group="overdue"]')).toHaveCount(0);
});

test('U09: the habits page has one filled button', async ({ page }) => {
  await enable(page, 'habits');
  await ready(page, '/habits?new=1');
  const dialog = page.getByRole('dialog', { name: 'Gewohnheit hinzufügen' });
  await dialog.getByRole('button', { name: 'Wasser trinken' }).click();
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('habit-card')).toHaveCount(1);
  const filled = await page
    .locator('main button:visible')
    .evaluateAll((els) => els.filter((el) => /_primary_/.test(el.className)).length);
  expect(filled).toBeLessThanOrEqual(1);
});
