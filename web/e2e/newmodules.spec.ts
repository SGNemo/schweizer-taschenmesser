import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

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
  await enable(page, ['pantry', 'shopping']);
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
  await page.goto('/shopping');
  await expect(page.getByText('Milch')).toBeVisible();

  await page.goto('/pantry');
  await page.getByRole('button', { name: 'Milch: einer mehr' }).click();
  await expect(fridge.getByRole('listitem').filter({ hasText: 'Milch' })).toContainText('2 Stück');
  await expect(fridge.getByRole('listitem').filter({ hasText: 'Milch' })).not.toContainText(
    'Wird knapp',
  );
});

test('pantry: without the shopping module the hand-over says so and sends nothing', async ({
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

test('time tracking: project, timer, manual entry, week sums and a time sheet', async ({
  page,
}) => {
  await enable(page, ['timetrack']);
  await page.goto('/timetrack');
  await expect(page.getByText('Erst ein Projekt anlegen')).toBeVisible();
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  const projects = page.getByRole('dialog', { name: 'Projekte' });
  await projects.getByLabel('Projektname').fill('Website');
  await projects.getByRole('button', { name: 'Projekt anlegen' }).click();
  await expect(projects.getByText('Website')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Starten' }).click();
  await expect(page.getByTestId('running')).toContainText('Website');
  await expect(page.getByRole('button', { name: 'Starten' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Stoppen' }).click();
  await expect(page.getByTestId('running')).toHaveCount(0);
  // The frozen clock makes the stopped timer the minimum of one minute.
  await expect(page.getByRole('region', { name: '29.09.2026' })).toContainText('Website · 0:01 h');

  await page.getByRole('button', { name: 'Zeit nachtragen' }).click();
  const entry = page.getByRole('dialog', { name: 'Zeit nachtragen' });
  await entry.getByLabel('Dauer').fill('nichts');
  await entry.getByRole('button', { name: 'Speichern' }).click();
  await expect(entry.getByText('Bitte eine Dauer angeben')).toBeVisible();
  await entry.getByLabel('Dauer').fill('1:30');
  await entry.getByLabel('Notiz (optional)').fill('Sitzung; "wichtig"');
  await entry.getByRole('button', { name: 'Speichern' }).click();
  await expect(entry).toBeHidden();
  await expect(page.getByTestId('week-total')).toHaveText('1:31 h');
  await expect(page.getByTestId('today-total')).toHaveText('1:31 h');

  await page.getByRole('button', { name: 'Stundenzettel exportieren' }).click();
  const dialog = page.getByRole('dialog', { name: 'Stundenzettel exportieren' });
  await expect(dialog.getByLabel('Monat')).toHaveValue('2026-09');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'CSV speichern' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('Stundenzettel-2026-09.csv');
  const csv = readFileSync((await file.path())!, 'utf8');
  expect(csv).toContain('29.09.2026;Website;1:30;1,50;"Sitzung; ""wichtig"""');
  expect(csv).toContain('Summe;;1:31;1,52;');
});

test('time tracking: only one timer runs, it survives a reload', async ({ page }) => {
  await enable(page, ['timetrack']);
  await page.goto('/timetrack');
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.getByRole('dialog', { name: 'Projekte' }).getByLabel('Projektname').fill('Büro');
  await page
    .getByRole('dialog', { name: 'Projekte' })
    .getByRole('button', { name: 'Projekt anlegen' })
    .click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Starten' }).click();
  await expect(page.getByTestId('running')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('running')).toContainText('Büro');
  await expect(page.getByRole('button', { name: 'Starten' })).toHaveCount(0);
});

test('gift ideas: per person, status filter and what was spent', async ({ page }) => {
  await enable(page, ['gifts']);
  await page.goto('/gifts');
  await expect(page.getByText('Noch keine Ideen')).toBeVisible();
  await page.getByRole('button', { name: 'Idee hinzufügen' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Idee hinzufügen' });
  await dialog.getByLabel('Idee', { exact: true }).fill('Kochbuch');
  await dialog.getByLabel('Für wen').fill('Anna');
  await dialog.getByLabel('Anlass (optional)').fill('Geburtstag');
  await dialog.getByLabel('Preis in € (optional)').fill('19,90');
  await dialog.getByLabel('Link (optional)').fill('javascript:alert(1)');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();

  const anna = page.getByRole('region', { name: 'Anna' });
  await expect(anna).toContainText('Kochbuch');
  await expect(anna).toContainText('Geburtstag · 19,90');
  // A script link is dropped, not stored as a clickable link.
  await expect(anna.getByRole('button', { name: /Link öffnen/ })).toHaveCount(0);
  await expect(page.getByTestId('gifts-total')).toContainText('gekauft für 0,00');

  await anna.getByRole('button', { name: /Kochbuch/ }).click();
  await page
    .getByRole('dialog', { name: 'Idee bearbeiten' })
    .getByLabel('Stand')
    .selectOption('bought');
  await page
    .getByRole('dialog', { name: 'Idee bearbeiten' })
    .getByRole('button', { name: 'Speichern' })
    .click();
  await expect(page.getByTestId('gifts-total')).toContainText('1 Ideen, davon gekauft für 19,90');

  await page.getByRole('button', { name: 'Verschenkt', exact: true }).click();
  await expect(page.getByText('Nichts in dieser Ansicht.')).toBeVisible();
  await page.getByRole('button', { name: 'Gekauft', exact: true }).click();
  await expect(anna).toContainText('Kochbuch');
});
