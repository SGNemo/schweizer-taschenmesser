import { expect, test } from '@playwright/test';
import { ready } from './helpers';

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

  await page.getByRole('checkbox', { name: 'ToDos' }).check();
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
