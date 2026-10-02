import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

async function addTodo(page: Page, title: string) {
  await page.getByRole('textbox', { name: 'ToDo hinzufügen' }).fill(title);
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: title })).toBeVisible();
}

test.describe('undo', () => {
  test('ticking a ToDo offers "Rückgängig" in the toast and brings it back', async ({ page }) => {
    await ready(page, '/todos');
    await addTodo(page, 'Zeitung abbestellen');
    await page.getByRole('checkbox', { name: 'Zeitung abbestellen' }).click();
    await expect(page.getByText('Als erledigt markiert.')).toBeVisible();
    await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await expect(page.getByText('Rückgängig gemacht.')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Zeitung abbestellen' })).not.toBeChecked();
  });

  test('deleting a ToDo can be undone with Ctrl+Z', async ({ page }, info) => {
    test.skip(info.project.name === 'pixel-7', 'keyboard shortcut is a desktop feature');
    await ready(page, '/todos');
    await addTodo(page, 'Altpapier rausstellen');
    await page.getByRole('button', { name: /Altpapier rausstellen/ }).click();
    await page
      .getByRole('dialog', { name: 'Aufgabe bearbeiten' })
      .getByRole('button', { name: 'Löschen' })
      .click();
    await expect(page.getByRole('checkbox', { name: 'Altpapier rausstellen' })).toHaveCount(0);
    await expect(page.getByText('ToDo gelöscht.')).toBeVisible();
    await page.keyboard.press('Control+z');
    await expect(page.getByRole('checkbox', { name: 'Altpapier rausstellen' })).toBeVisible();
  });

  test('Ctrl+Z with nothing to undo says so', async ({ page }, info) => {
    test.skip(info.project.name === 'pixel-7', 'keyboard shortcut is a desktop feature');
    await ready(page, '/');
    await page.keyboard.press('Control+z');
    await expect(page.getByText('Nichts zum Rückgängigmachen.')).toBeVisible();
  });
});

test.describe('keyboard (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard shortcuts are a desktop feature');

  test('N opens quick capture, ? the shortcut sheet; neither fires inside a field', async ({
    page,
  }) => {
    await ready(page, '/');
    await page.keyboard.press('n');
    await expect(page.getByRole('dialog', { name: 'Schnell hinzufügen' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.keyboard.press('Shift+?');
    const sheet = page.getByRole('dialog', { name: 'Tastenkürzel' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Letzte Aktion rückgängig machen')).toBeVisible();
    await page.keyboard.press('Escape');

    await ready(page, '/todos');
    await page.getByRole('textbox', { name: 'ToDo hinzufügen' }).press('n');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('G then a letter jumps to an area, J/K walk the rows', async ({ page }) => {
    await ready(page, '/');
    await page.keyboard.press('g');
    await page.keyboard.press('p');
    await expect(page).toHaveURL(/\/calendar$/);
    await page.keyboard.press('g');
    await page.keyboard.press('g');
    await expect(page).toHaveURL(/\/finance$/);

    // J/K walk the rows of a list built from ItemRow (here the component sheet).
    await ready(page, '/dev/components');
    await page.locator('main').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('j');
    await expect(page.getByRole('button', { name: /Stadtwerke Musterstadt/ })).toBeFocused();
    await page.keyboard.press('j');
    await expect(page.getByRole('button', { name: /Zahnarztpraxis/ })).toBeFocused();
    await page.keyboard.press('k');
    await expect(page.getByRole('button', { name: /Stadtwerke Musterstadt/ })).toBeFocused();
  });
});

test.describe('component sheet', () => {
  test('a dirty dialog asks before it throws the draft away; the sheet is a bottom sheet on phones', async ({
    page,
  }, info) => {
    await ready(page, '/dev/components');
    await page.getByRole('button', { name: 'Dialog öffnen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Neuer Eintrag' });
    await dialog.getByLabel('Name').fill('Anna');

    if (info.project.name === 'pixel-7') {
      const box = await dialog.boundingBox();
      const viewport = page.viewportSize()!;
      expect(box!.y + box!.height).toBeGreaterThan(viewport.height - 2); // docked to the bottom
      expect(box!.width).toBeGreaterThan(viewport.width - 2);
    }

    await page.keyboard.press('Escape');
    await expect(dialog.getByText('Entwurf verwerfen?')).toBeVisible();
    await dialog.getByRole('button', { name: 'Weiter bearbeiten' }).click();
    await expect(dialog.getByLabel('Name')).toHaveValue('Anna');
    await page.keyboard.press('Escape');
    await dialog.getByRole('button', { name: 'Verwerfen' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // the draft is still there for 30 seconds
    await page.getByRole('button', { name: 'Dialog öffnen' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Neuer Eintrag' }).getByLabel('Name'),
    ).toHaveValue('Anna');
  });

  test('rows can be selected with a Shift range and the bar clears with Esc', async ({ page }) => {
    await ready(page, '/dev/components');
    const boxes = page.getByRole('checkbox', { name: 'Auswählen' });
    await boxes.nth(0).click();
    await boxes.nth(2).click({ modifiers: ['Shift'] });
    await expect(page.getByText('3 ausgewählt')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('3 ausgewählt')).toHaveCount(0);
  });

  test('toasts stack at most two', async ({ page }) => {
    await ready(page, '/dev/components');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Toast zeigen' }).click();
    await expect(page.getByText('Als bezahlt markiert.')).toHaveCount(2);
  });
});
