import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { enable } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

/** All rows of a Dexie table, straight from IndexedDB (the app must have opened the DB once). */
async function rows(page: Page, table: string): Promise<Record<string, unknown>[]> {
  return page.evaluate(
    (name) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction(name).objectStore(name).getAll();
          req.onsuccess = () => {
            db.close();
            resolve(req.result as Record<string, unknown>[]);
          };
          req.onerror = () => reject(req.error);
        };
      }),
    table,
  );
}

/** Switches "Ohne Rückfrage speichern" off, so a doubtful text asks where it should go (the old behaviour). */
async function askBeforeGuessing(page: Page) {
  await page.goto('/settings/schnellerfassung');
  const sw = page.getByRole('switch', { name: 'Ohne Rückfrage speichern' });
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
}

const input = (page: Page) => page.getByRole('textbox', { name: 'Was möchtest du festhalten?' });

test('the quick-add button captures an appointment from free text and can undo it', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Schnell hinzufügen' }).click();
  await expect(input(page)).toBeFocused();

  await input(page).fill('morgen 15 Uhr Zahnarzt');
  const chips = page.getByTestId('capture-chips');
  await expect(chips).toContainText('Ziel: Kalender');
  await expect(chips).toContainText('Morgen, 30. Sep.');
  await expect(chips).toContainText('15:00 Uhr');
  await input(page).press('Enter');

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Gespeichert in Kalender')).toBeVisible();
  const [event] = await rows(page, 'calendar_event');
  expect(event).toMatchObject({ title: 'Zahnarzt', startDate: '2026-09-30', startTime: '15:00' });

  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByText('Rückgängig gemacht.')).toBeVisible();
  const after = await rows(page, 'calendar_event');
  expect(after[0]?.deletedAt).toBeTruthy();
});

test('plain text becomes a ToDo; ArrowDown switches the type before saving', async ({ page }) => {
  await page.goto('/?capture=1');
  await expect(input(page)).toBeFocused();
  await input(page).fill('Blumen gießen');
  await expect(page.getByTestId('capture-chips')).toContainText('Ziel: ToDos');
  await input(page).press('ArrowDown');
  await expect(page.getByTestId('capture-chips')).toContainText('Ziel: Kalender');
  await input(page).press('ArrowUp');
  await input(page).press('Enter');
  await expect(page.getByText('Gespeichert in ToDos')).toBeVisible();
  const [task] = await rows(page, 'todos_task');
  expect(task).toMatchObject({ title: 'Blumen gießen', listId: 'inbox' });
});

test('a doubtful input is not saved until the user chooses (question on)', async ({ page }) => {
  await askBeforeGuessing(page);
  await page.goto('/?capture=1');
  await input(page).fill('Zahnarzt morgen 15 Uhr 80 €');
  // The type buttons appear once the module states are loaded; only then does Enter mean something.
  await expect(page.getByRole('radio', { name: 'Termin' })).toBeVisible();
  await input(page).press('Enter');
  await expect(page.getByRole('alert')).toContainText('Bitte wähle');
  expect(await rows(page, 'calendar_event')).toHaveLength(0);
  await page.getByRole('radio', { name: 'Termin' }).click();
  await input(page).press('Enter');
  await expect(page.getByText('Gespeichert in Kalender')).toBeVisible();
});

test('finance stays a draft until it is confirmed', async ({ page }) => {
  await page.goto('/?capture=1');
  await input(page).fill('$ 12,50 Mittagessen');
  await expect(page.getByTestId('capture-chips')).toContainText('Ziel: Finanzen');
  await input(page).press('Enter');
  await expect(page.getByTestId('capture-draft')).toContainText('12,50');
  expect(await rows(page, 'finance_transaction')).toHaveLength(0);
  await page.getByRole('button', { name: 'Buchen' }).click();
  await expect(page.getByText('Gespeichert in Finanzen')).toBeVisible();
  const [tx] = await rows(page, 'finance_transaction');
  expect(tx).toMatchObject({ amountMinor: 1250, kind: 'expense', payee: 'Mittagessen' });
});

test('a disabled module is never written to', async ({ page }) => {
  await askBeforeGuessing(page);
  await page.goto('/?capture=1');
  await input(page).fill('https://beispiel.example/artikel lesen');
  // Merkliste is off by default: the type is not offered, so the user has to choose another.
  await expect(page.getByRole('radio', { name: 'ToDo' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Merkliste' })).toHaveCount(0);
  await input(page).press('Enter');
  await expect(page.getByRole('alert')).toContainText('Bitte wähle');
  expect(await rows(page, 'bookmarks_item')).toHaveLength(0);
});

test('shared text gets a suggestion and can be saved to the Merkliste directly', async ({
  page,
}) => {
  await enable(page, 'bookmarks');
  await page.goto(
    '/share?title=Sch%C3%B6ner%20Weg&text=Schau%20mal%20https%3A%2F%2Fwandern.example%2Fweg',
  );
  await expect(page.getByTestId('capture-chips')).toContainText('Ziel: Merkliste');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Gespeichert in Merkliste')).toBeVisible();
  const [item] = await rows(page, 'bookmarks_item');
  expect(item).toMatchObject({ url: 'https://wandern.example/weg', kind: 'link' });
});

test('the capture window page saves, confirms and is accessible', async ({ page }) => {
  await page.goto('/capture.html');
  await expect(input(page)).toBeFocused();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);

  await input(page).fill('Steuer machen');
  await input(page).press('Enter');
  await expect(page.getByTestId('capture-saved')).toContainText('Gespeichert in ToDos');
  const [task] = await rows(page, 'todos_task');
  expect(task).toMatchObject({ title: 'Steuer machen' });
});

test('the settings page explains that hotkey and tray belong to the Windows app', async ({
  page,
}) => {
  await page.goto('/settings/schnellerfassung');
  await expect(page.getByRole('heading', { name: 'Schnellerfassung' })).toBeVisible();
  await expect(
    page.getByText('Tastenkürzel, Tray und Autostart gibt es nur in der Windows-App.'),
  ).toBeVisible();
});

test('without the question a doubtful text lands in the ToDo inbox as typed, and can be sorted later', async ({
  page,
}) => {
  await page.goto('/?capture=1');
  await input(page).fill('Zahnarzt morgen 15 Uhr 80 €');
  await expect(page.getByTestId('capture-inbox-hint')).toContainText('Landet in „ToDos“');
  await input(page).press('Enter');
  await expect(page.getByText('Gespeichert in ToDos')).toBeVisible();
  const [task] = await rows(page, 'todos_task');
  expect(task).toMatchObject({ title: 'Zahnarzt morgen 15 Uhr 80 €', listId: 'inbox' });
  expect(await rows(page, 'calendar_event')).toHaveLength(0);
});

test('Ctrl+Enter opens the full ToDo form with the typed text', async ({ page }, info) => {
  test.skip(info.project.name === 'pixel-7', 'keyboard shortcut is a desktop feature');
  await page.goto('/?capture=1');
  await input(page).fill('Blumen gießen');
  await expect(page.getByText('Strg+Enter öffnet das ganze Formular.')).toBeVisible();
  await input(page).press('Control+Enter');
  await expect(page).toHaveURL(/\/todos/);
  await expect(page.getByLabel('ToDo hinzufügen')).toHaveValue('Blumen gießen');
  expect(await rows(page, 'todos_task')).toHaveLength(0);
});
