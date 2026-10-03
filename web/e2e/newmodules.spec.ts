import { expect, test, type Page } from '@playwright/test';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

/** Enables modules with a raw write into the module table (like the library would do). */
async function enable(page: Page, ids: string[]) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    (list) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          for (const id of list)
            tx.objectStore('_modules').put({
              id,
              enabled: true,
              dataPolicy: null,
              createdAt: 1,
              updatedAt: 1,
              deviceId: 'e2e',
              deletedAt: null,
              _f: {},
            });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    ids,
  );
}

test('pantry: expiry, low stock and the hand-over to the shopping list', async ({ page }) => {
  await enable(page, ['pantry', 'lists']);
  await page.goto('/pantry');
  await page.getByRole('button', { name: 'Vorrat hinzufügen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Vorrat hinzufügen' });
  await dialog.getByLabel('Name', { exact: true }).fill('Milch');
  await dialog.getByLabel('Ort').selectOption('fridge');
  await dialog.getByLabel('Vorrat (Anzahl)').fill('1');
  await dialog.getByLabel('Nachkaufen ab (Anzahl, optional)').fill('1');
  await dialog.getByLabel('Haltbar bis (optional)').fill('2026-09-30');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();

  const fridge = page.getByRole('region', { name: 'Kühlschrank' });
  const row = fridge.getByRole('listitem').filter({ hasText: 'Milch' });
  await expect(row).toContainText('Läuft morgen ab');
  await expect(row).toContainText('Wird knapp');

  await page.getByRole('button', { name: 'Nachkaufen', exact: true }).click();
  await expect(row).toBeVisible();
  await page.getByRole('button', { name: 'Läuft bald ab', exact: true }).click();
  await expect(row).toBeVisible();
  await page.getByRole('button', { name: 'Alle', exact: true }).click();

  await row.getByRole('button', { name: 'Auf die Einkaufsliste' }).click();
  await expect(page.getByText('an die Einkaufsliste gesendet')).toBeVisible();
  await page.goto('/lists');
  await expect(page.getByRole('checkbox', { name: 'Milch' })).toBeVisible();

  await page.goto('/pantry');
  await page.getByRole('button', { name: 'Milch: einer mehr' }).click();
  await expect(fridge.getByRole('listitem').filter({ hasText: 'Milch' })).toContainText('2 Stück');
  await expect(fridge.getByRole('listitem').filter({ hasText: 'Milch' })).not.toContainText(
    'Wird knapp',
  );
});

test('pantry: the hand-over also arrives when the app loads slowly (services start late)', async ({
  page,
}) => {
  await enable(page, ['pantry', 'lists']);
  // Every script chunk arrives late, like on a busy CI runner: the services of the modules are
  // dynamic imports that start one after the other, long after the page can be clicked.
  await page.route('**/assets/*.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.goto('/pantry');
  await page.getByRole('button', { name: 'Vorrat hinzufügen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Vorrat hinzufügen' });
  await dialog.getByLabel('Name', { exact: true }).fill('Milch');
  await dialog.getByLabel('Ort').selectOption('fridge');
  await dialog.getByLabel('Vorrat (Anzahl)').fill('1');
  await dialog.getByLabel('Nachkaufen ab (Anzahl, optional)').fill('1');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();

  const row = page
    .getByRole('region', { name: 'Kühlschrank' })
    .getByRole('listitem')
    .filter({ hasText: 'Milch' });
  await row.getByRole('button', { name: 'Auf die Einkaufsliste' }).click();
  // The confirmation comes only once the item is stored, so the list shows it right away.
  await expect(page.getByText('an die Einkaufsliste gesendet')).toBeVisible();
  await page.unroute('**/assets/*.js');
  await page.goto('/lists');
  await expect(page.getByRole('checkbox', { name: 'Milch' })).toBeVisible();
});

test('pantry: without the lists module the hand-over says so and sends nothing', async ({
  page,
}) => {
  await enable(page, ['pantry']);
  await page.goto('/pantry');
  await page.getByRole('button', { name: 'Vorrat hinzufügen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Vorrat hinzufügen' });
  await dialog.getByLabel('Name', { exact: true }).fill('Butter');
  await dialog.getByLabel('Vorrat (Anzahl)').fill('0');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Auf die Einkaufsliste' }).click();
  await expect(page.getByText('Die Einkaufsliste ist ausgeschaltet')).toBeVisible();
  await expect(page.getByText('an die Einkaufsliste gesendet')).toHaveCount(0);
});

test('gift ideas: per person, status and what was spent', async ({ page }) => {
  await enable(page, ['people']);
  await page.goto('/people');
  await expect(page.getByText('Noch keine Personen')).toBeVisible();
  await page.getByRole('button', { name: 'Person hinzufügen' }).first().click();
  const person = page.getByRole('dialog', { name: 'Person hinzufügen' });
  await person.getByLabel('Name', { exact: true }).fill('Anna');
  await person.getByRole('button', { name: 'Speichern' }).click();
  await expect(person).toBeHidden();
  await page.getByRole('button', { name: /^Anna(?! per WhatsApp)/ }).click();
  await expect(page.getByRole('heading', { name: 'Anna' })).toBeVisible();

  await page.getByRole('button', { name: 'Geschenkidee hinzufügen' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Geschenkidee hinzufügen' });
  await dialog.getByLabel('Idee', { exact: true }).fill('Kochbuch');
  await dialog.getByLabel('Anlass (optional)').fill('Geburtstag');
  await dialog.getByLabel('Preis in € (optional)').fill('19,90');
  await dialog.getByLabel('Link (optional)').fill('javascript:alert(1)');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();

  const gifts = page.getByRole('list', { name: 'Geschenke' });
  await expect(gifts).toContainText('Kochbuch');
  await expect(gifts).toContainText('Geburtstag · 19,90');
  // A script link is dropped, not stored as a clickable link.
  await expect(gifts.getByRole('button', { name: /Link öffnen/ })).toHaveCount(0);
  await expect(page.getByTestId('gifts-total')).toHaveCount(0);

  await gifts.getByRole('button', { name: /Kochbuch/ }).click();
  await page
    .getByRole('dialog', { name: 'Geschenkidee bearbeiten' })
    .getByLabel('Stand')
    .selectOption('bought');
  await page
    .getByRole('dialog', { name: 'Geschenkidee bearbeiten' })
    .getByRole('button', { name: 'Speichern' })
    .click();
  await expect(page.getByTestId('gifts-total')).toContainText(
    '1 Geschenke gekauft oder verschenkt für 19,90',
  );
});
