import { expect, test, type Locator, type Page } from '@playwright/test';
import { enable } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

/** Controlled checkboxes update after the (async) database write: click, then wait for the state. */
async function tick(box: Locator) {
  await box.click();
  await expect(box).toBeChecked();
}

const rows = (page: Page) => page.getByRole('list', { name: 'Einkauf' }).getByRole('listitem');

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('main h1')).toBeVisible();
}

async function save(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('Einkauf: quantities, duplicates, ticking, clearing bought entries (and undo)', async ({
  page,
}) => {
  await enable(page, 'lists');
  await open(page, '/lists');
  await expect(page.getByRole('button', { name: 'Einkauf', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const input = page.getByLabel('Eintrag hinzufügen');
  await input.fill('2 Milch');
  await input.press('Enter');
  await expect(page.getByRole('checkbox', { name: 'Milch' })).toBeVisible();
  await input.fill('Brot');
  await input.press('Enter');
  await expect(page.getByRole('checkbox', { name: 'Brot' })).toBeVisible();
  await input.fill('brot'); // a duplicate of an open entry is ignored
  await input.press('Enter');
  await expect(rows(page)).toHaveCount(2);
  await expect(page.getByText('2', { exact: true })).toBeVisible(); // the quantity

  await tick(page.getByRole('checkbox', { name: 'Milch' }));
  await page.getByRole('button', { name: 'Gekauftes entfernen (1)' }).click();
  await expect(page.getByText('1 Artikel entfernt.')).toBeVisible();
  await expect(rows(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Rückgängig' }).last().click();
  await expect(rows(page)).toHaveCount(2);
});

test('Packliste: pack, reset, copy as template, checklist and delete', async ({ page }) => {
  await enable(page, 'lists');
  await open(page, '/lists');
  await page.getByRole('button', { name: 'Neue Liste' }).click();
  const dialog = page.getByRole('dialog', { name: 'Neue Liste' });
  await dialog.getByLabel('Name der Liste').fill('Urlaub');
  await dialog.getByLabel('Art').selectOption({ label: 'Packliste' });
  await save(page);
  await expect(page.getByRole('button', { name: 'Urlaub', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const input = page.getByLabel('Eintrag hinzufügen');
  for (const item of ['Zahnbürste', 'Ladekabel']) {
    await input.fill(item);
    await input.press('Enter');
    // the write is async: wait for the row before the next fill, or the field is reset under it
    await expect(page.getByRole('checkbox', { name: item })).toBeVisible();
  }
  await expect(page.getByTestId('lists-progress')).toContainText('0 von 2 gepackt');
  await tick(page.getByRole('checkbox', { name: 'Zahnbürste' }));
  await expect(page.getByTestId('lists-progress')).toContainText('1 von 2 gepackt');
  await tick(page.getByRole('checkbox', { name: 'Ladekabel' }));
  await expect(page.getByTestId('lists-progress')).toContainText('Alles gepackt!');

  await page.getByRole('button', { name: 'Als Vorlage kopieren' }).click();
  await expect(page.getByRole('button', { name: 'Kopie von Urlaub' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByTestId('lists-progress')).toContainText('0 von 2 gepackt');

  await page.getByRole('button', { name: 'Urlaub', exact: true }).click();
  await page.getByRole('button', { name: 'Alles zurücksetzen' }).click();
  await expect(page.getByTestId('lists-progress')).toContainText('0 von 2 gepackt');

  // Delete the copy through the editor; the shopping list cannot be deleted.
  await page.getByRole('button', { name: 'Kopie von Urlaub' }).click();
  await page.getByRole('button', { name: 'Liste bearbeiten' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Liste löschen' }).click();
  await expect(page.getByRole('button', { name: 'Kopie von Urlaub' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Einkauf', exact: true }).click();
  await page.getByRole('button', { name: 'Liste bearbeiten' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Liste löschen' })).toHaveCount(
    0,
  );
});

test('Lesezeichen: links as tiles, grouped by the first tag', async ({ page }) => {
  await enable(page, 'bookmarks');
  await open(page, '/bookmarks?view=links');
  await expect(page.getByText('Noch keine Lesezeichen')).toBeVisible();
  await page.getByRole('button', { name: 'Lesezeichen anlegen' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titel').fill('Bahn');
  await dialog.getByLabel('Adresse (Link)').fill('https://bahn.example.org');
  await dialog.getByLabel('Tags').fill('Reisen');
  await save(page);
  await expect(page.getByRole('heading', { name: 'Reisen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bahn bahn.example.org' })).toBeVisible();
  await page.getByRole('button', { name: 'Merkliste', exact: true }).click();
  await expect(page.getByRole('button', { name: /Bahn Link/ })).toBeVisible();
});
