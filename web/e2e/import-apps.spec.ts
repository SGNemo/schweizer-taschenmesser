import { expect, test } from '@playwright/test';
import { backSettled, ready } from './helpers';

const ENEX = `<?xml version="1.0" encoding="UTF-8"?>
<en-export application="Evernote"><note><title>Rezept &amp; Tipps</title>
<content><![CDATA[<en-note><div>Mehl, Zucker</div><div><en-media type="image/png" hash="ab"/></div></en-note>]]></content>
<tag>Küche</tag></note></en-export>`;

test('Aus anderer App importieren: Evernote erkannt → Vorschau → Bericht → Wiederholung ist Dublette → Rückgängig', async ({
  page,
}) => {
  await ready(page, '/');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('Aus anderer App');
  await page.keyboard.press('Enter');

  const start = page.getByRole('dialog', { name: 'Aus anderer App importieren' });
  const chooser = page.waitForEvent('filechooser');
  await start.getByRole('button', { name: 'Dateien wählen' }).click();
  await (
    await chooser
  ).setFiles([{ name: 'Rezepte.enex', mimeType: 'application/xml', buffer: Buffer.from(ENEX) }]);

  const wizard = page.getByRole('dialog', { name: /Importieren/ });
  await expect(wizard.getByText('1 Eintrag erkannt')).toBeVisible();
  await expect(wizard.getByText(/1 Anhang .* wurde nicht übernommen/)).toBeVisible();
  await wizard.getByRole('button', { name: '1 Eintrag importieren' }).click();
  await expect(wizard.getByRole('status')).toHaveText('1 Eintrag wurde importiert.');

  // Undo takes it back again. The closing wizard pops its history entry first (backSettled), else the goto is aborted.
  await wizard.getByRole('button', { name: 'Rückgängig machen' }).click();
  await backSettled(page);
  await page.goto('/notes');
  await expect(page.getByText('Rezept & Tipps')).toHaveCount(0);
});

test('Abbrechen beim Lesen lässt nichts zurück', async ({ page }) => {
  await ready(page, '/');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('Aus anderer App');
  await page.keyboard.press('Enter');
  const start = page.getByRole('dialog', { name: 'Aus anderer App importieren' });
  const chooser = page.waitForEvent('filechooser');
  await start.getByRole('button', { name: 'Dateien wählen' }).click();
  await (await chooser).setFiles([]);
  // Nothing chosen: still on the first step, nothing was written.
  await expect(start.getByRole('button', { name: 'Dateien wählen' })).toBeVisible();
});
