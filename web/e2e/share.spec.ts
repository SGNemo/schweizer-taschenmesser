import { expect, test } from '@playwright/test';
import { ready, showPreview } from './helpers';

// Preview modules, tools, connectors and sections are listed only with "In Arbeit anzeigen" (maturity).
test.beforeEach(({ page }) => showPreview(page));

test('a share file made with a code opens with that code, wrong codes are refused', async ({
  page,
}, info) => {
  test.skip(
    info.project.name === 'pixel-7',
    'same flow as desktop; file download is covered there',
  );
  await ready(page, '/settings/verbindungen');

  // Nothing is chosen by default: saving asks for at least one area.
  await page.getByRole('button', { name: 'Datei speichern' }).click();
  await expect(page.getByRole('alert')).toContainText('mindestens einen Bereich');

  await page.getByTestId('share-once-modules').getByRole('checkbox', { name: 'ToDos' }).check();
  const code = (await page.getByTestId('share-code').innerText()).trim();
  expect(code.split(/\s+/)).toHaveLength(6);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Datei speichern' }).click(),
  ]);
  const path = await download.path();
  expect(download.suggestedFilename()).toMatch(/^nemo-teilen-\d{4}-\d{2}-\d{2}\.json$/);

  await page.locator('#share-file').setInputFiles(path);
  await page.getByLabel('Kopplungscode der Datei').fill('falsch falsch falsch');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByTestId('share-error')).toContainText('Falscher Code');

  await page.getByLabel('Kopplungscode der Datei').fill(code.toUpperCase());
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByTestId('share-plan')).toBeVisible();
  await page.getByRole('button', { name: 'Zusammenführen' }).click();
  await expect(page.getByText(/zusammengeführt/)).toBeVisible();
});

test('a standing connection saves only what changed and opens its own files without asking for the code', async ({
  page,
}, info) => {
  test.skip(
    info.project.name === 'pixel-7',
    'same flow as desktop; file download is covered there',
  );
  await ready(page, '/todos');
  await page.getByRole('textbox', { name: 'ToDo hinzufügen' }).fill('Milch kaufen');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Milch kaufen' })).toBeVisible();
  await page.goto('/settings/verbindungen');
  const pairs = page.getByTestId('share-pairs');
  await pairs.getByLabel('Name der Verbindung (z. B. Anna)').fill('Anna');
  await pairs.getByRole('checkbox', { name: 'ToDos' }).check();
  await pairs.getByRole('button', { name: 'Verbindung anlegen' }).click();
  await expect(page.getByTestId('share-pair-code')).toBeVisible();
  const row = page.getByTestId('share-pair').filter({ hasText: 'Anna' });
  await expect(row).toContainText('Noch nichts gesendet');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    row.getByRole('button', { name: 'Änderungen als Datei speichern' }).click(),
  ]);
  const path = await download.path();
  await expect(row).toContainText('Zuletzt gesendet');

  // Nothing changed since: no second file.
  await row.getByRole('button', { name: 'Änderungen als Datei speichern' }).click();
  await expect(page.getByText('Seit der letzten Datei hat sich nichts geändert.')).toBeVisible();

  // The file belongs to the connection: the stored code is used, no code field.
  await page.locator('#share-file').setInputFiles(path);
  await expect(page.getByText(/Der gespeicherte Code wird benutzt/)).toBeVisible();
  await expect(page.getByLabel('Kopplungscode der Datei')).toHaveCount(0);
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByTestId('share-plan')).toBeVisible();
  await page.getByRole('button', { name: 'Zusammenführen' }).click();
  await expect(row).toContainText('Zuletzt empfangen');

  await row.getByRole('button', { name: 'Verbindung „Anna“ entfernen' }).click();
  await expect(page.getByTestId('share-pair')).toHaveCount(0);
});

test('a connection can show its changes as QR pictures that run, pause and count as handed over', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'pixel-7', 'same flow as desktop');
  await ready(page, '/todos');
  await page.getByRole('textbox', { name: 'ToDo hinzufügen' }).fill('Brot kaufen');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Brot kaufen' })).toBeVisible();
  await page.goto('/settings/verbindungen');
  const pairs = page.getByTestId('share-pairs');
  await pairs.getByLabel('Name der Verbindung (z. B. Anna)').fill('Ben');
  await pairs.getByRole('checkbox', { name: 'ToDos' }).check();
  await pairs.getByRole('button', { name: 'Verbindung anlegen' }).click();
  const row = page.getByTestId('share-pair').filter({ hasText: 'Ben' });
  await row.getByRole('button', { name: 'Als QR-Bilder zeigen' }).click();

  const player = page.getByTestId('share-qr-player');
  await expect(player.getByRole('img')).toBeVisible();
  const frame = player.getByTestId('share-qr-frame');
  const first = await frame.innerText();
  await expect.poll(async () => frame.innerText(), { timeout: 8000 }).not.toBe(first);

  await player.getByRole('button', { name: 'Anhalten' }).click();
  const paused = await frame.innerText();
  await page.waitForTimeout(1200);
  expect(await frame.innerText()).toBe(paused);

  await player.getByRole('button', { name: 'Fertig gezeigt' }).click();
  await expect(
    page.getByText(/Gezeigt: 1 geänderter? Eintrag|Gezeigt: \d+ geänderte/),
  ).toBeVisible();
  await expect(row).toContainText('Zuletzt gesendet');
});

test('a connection can share only chosen lists of a module', async ({ page }, info) => {
  test.skip(info.project.name === 'pixel-7', 'same flow as desktop');
  await ready(page, '/todos');
  await page.getByRole('textbox', { name: 'ToDo hinzufügen' }).fill('Zelt packen');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Zelt packen' })).toBeVisible();
  await page.goto('/settings/verbindungen');
  const pairs = page.getByTestId('share-pairs');
  await pairs.getByLabel('Name der Verbindung (z. B. Anna)').fill('Clara');
  await pairs.getByRole('checkbox', { name: 'ToDos', exact: true }).check();
  const lists = page.getByTestId('share-lists-todos');
  await expect(lists).toBeVisible();
  await lists.getByRole('checkbox').first().check();
  await pairs.getByRole('button', { name: 'Verbindung anlegen' }).click();
  await expect(page.getByTestId('share-pair').filter({ hasText: 'Clara' })).toContainText(
    'nur ausgewählte Listen',
  );
});
