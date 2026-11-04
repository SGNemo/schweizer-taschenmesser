import { expect, test } from '@playwright/test';
import { enable } from './helpers';

test('Feeds: hinzufügen, gruppieren, doppelte erkennen, bearbeiten, entfernen', async ({
  page,
}) => {
  await enable(page, 'feeds');
  await page.goto('/feeds');
  await page.getByRole('button', { name: 'Feed hinzufügen' }).first().click();

  const dialog = page.getByRole('dialog', { name: 'Feed hinzufügen' });
  await dialog.getByRole('textbox', { name: /Adresse des Feeds/ }).fill('keine adresse');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'Das ist keine Web-Adresse (http oder https).',
  );

  await dialog
    .getByRole('textbox', { name: /Adresse des Feeds/ })
    .fill('blog.example.org/feed.xml');
  await dialog.getByRole('combobox', { name: 'Gruppe' }).fill('Blogs');
  await dialog.getByRole('button', { name: 'Speichern' }).click();

  // Name defaults to the host; the list is grouped.
  await expect(page.getByRole('heading', { name: /Blogs/ })).toBeVisible();
  await expect(page.getByText('blog.example.org').first()).toBeVisible();

  // The same feed twice is refused.
  await page.getByRole('button', { name: 'Feed hinzufügen' }).first().click();
  const again = page.getByRole('dialog', { name: 'Feed hinzufügen' });
  await again
    .getByRole('textbox', { name: /Adresse des Feeds/ })
    .fill('https://www.blog.example.org/feed.xml');
  await again.getByRole('button', { name: 'Speichern' }).click();
  await expect(again.getByRole('alert')).toHaveText('Diesen Feed hast du schon.');
  await again.getByRole('button', { name: 'Abbrechen' }).click();

  // Remove it again.
  await page.getByRole('button', { name: /Aktionen für blog.example.org/ }).click();
  await page.getByRole('menuitem', { name: /Entfernen/ }).click();
  await expect(page.getByText('Noch keine Feeds').first()).toBeVisible();
});
