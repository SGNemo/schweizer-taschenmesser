import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Tab "Einstellungen" of the disk module against the invented settings of
 * `core/platform/fakeDisk.ts` (E2E builds only). Nothing here touches a real Windows setting.
 */

/** Poses as the desktop app (E2E builds read `localStorage.__tmPlatformKind`). */
async function asDesktop(page: Page) {
  await page.addInitScript(() => localStorage.setItem('__tmPlatformKind', 'desktop'));
}

async function enableDisk(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          tx.objectStore('_modules').put({
            id: 'disk',
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
  );
}

async function openTweaks(page: Page) {
  await asDesktop(page);
  await enableDisk(page);
  await page.goto('/disk?tab=tweaks');
  await expect(page.getByRole('region', { name: 'Darstellung' })).toBeVisible();
}

test('settings tab: the catalogue in calm groups, each with risk and a Microsoft source', async ({
  page,
}) => {
  await openTweaks(page);
  for (const group of ['Darstellung', 'Explorer', 'Privatsphäre', 'Energie'])
    await expect(page.getByRole('heading', { name: group, exact: true })).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'Nichts von Nemo geändert.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Alle zurücksetzen' })).toBeDisabled();

  const row = page.getByTestId('tweak-hiddenFiles');
  await expect(row.getByRole('switch', { name: 'Versteckte Dateien anzeigen' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  // Details are folded until asked for.
  await expect(row.getByText('Risiko: gering.')).toBeHidden();
  await row.getByText('Mehr dazu').click();
  await expect(row.getByText('Risiko: gering.')).toBeVisible();
  await expect(
    row.getByText('Offene Explorer-Fenster zeigen es nach dem Aktualisieren'),
  ).toBeVisible();
  const source = row.getByRole('link', { name: /Quelle zu „Versteckte Dateien anzeigen“/ });
  await expect(source).toHaveAttribute('href', /^https:\/\/learn\.microsoft\.com\//);

  // A setting Windows has no stored value for shows no switch that pretends to know.
  const unset = page.getByTestId('tweak-trackAppLaunches');
  await expect(unset.getByText('Standard von Windows')).toBeVisible();
  await expect(unset.getByRole('switch')).toHaveCount(0);
  // The power plan is a choice among the plans of this PC.
  await expect(
    page.getByTestId('tweak-powerPlan').getByRole('combobox', { name: 'Energiesparplan wählen' }),
  ).toHaveValue('381b4222-f694-41f0-9685-ff5bb260df2e');

  // The restore point is Windows' own dialog, offered and never required.
  await page.getByRole('button', { name: 'Wiederherstellungspunkt anlegen' }).click();
  expect(
    await page.evaluate(() => (globalThis as { __tmCareTools?: string[] }).__tmCareTools),
  ).toEqual(['systemProtection']);
});

test('settings tab: a switch shows the new state, the history takes it back', async ({ page }) => {
  await openTweaks(page);
  const row = page.getByTestId('tweak-fileExtensions');
  const toggle = row.getByRole('switch', { name: 'Dateiendungen anzeigen' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(row.getByText('von Nemo geändert')).toBeVisible();
  await expect(page.getByText('Dateiendungen anzeigen: eingeschaltet. Der Wert')).toBeVisible();
  await expect(page.getByText('1 Einstellung von Nemo geändert.')).toBeVisible();

  await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  const history = page.getByRole('list', { name: 'Verlauf' });
  await expect(history).toContainText('Dateiendungen anzeigen: eingeschaltet');
  await history
    .getByRole('button', { name: 'Rückgängig: Dateiendungen anzeigen: eingeschaltet' })
    .click();
  await expect(history).toContainText('Zurückgenommen.');

  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(row.getByText('von Nemo geändert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Alle zurücksetzen' })).toBeDisabled();
});

test('settings tab: "Alle zurücksetzen" puts two changes back after asking', async ({ page }) => {
  await openTweaks(page);
  const animations = page
    .getByTestId('tweak-animations')
    .getByRole('switch', { name: 'Animationen in Fenstern' });
  const plan = page.getByTestId('tweak-powerPlan').getByRole('combobox');
  await animations.click();
  await expect(animations).toHaveAttribute('aria-checked', 'false');
  await plan.selectOption({ label: 'Energiesparmodus' });
  await expect(page.getByText('2 Einstellungen von Nemo geändert.')).toBeVisible();

  await page.getByRole('button', { name: 'Alle zurücksetzen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Alle zurücksetzen?' });
  await expect(dialog.getByRole('listitem')).toHaveText([
    'Animationen in Fenstern',
    'Energiesparplan',
  ]);
  // Cancelling changes nothing.
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(animations).toHaveAttribute('aria-checked', 'false');

  await page.getByRole('button', { name: 'Alle zurücksetzen' }).click();
  await dialog.getByRole('button', { name: 'Zurücksetzen', exact: true }).click();
  await expect(
    page.getByText('Zurückgesetzt: Animationen in Fenstern, Energiesparplan.'),
  ).toBeVisible();
  await expect(animations).toHaveAttribute('aria-checked', 'true');
  await expect(plan).toHaveValue('381b4222-f694-41f0-9685-ff5bb260df2e');
  await expect(page.getByText('von Nemo geändert', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Nichts von Nemo geändert.')).toBeVisible();

  await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  const history = page.getByRole('list', { name: 'Verlauf' });
  await expect(history).toContainText('Energiesparplan: geändert');
  await expect(history.getByRole('button', { name: /Rückgängig/ })).toHaveCount(0);
});

test('settings tab has no accessibility violations', async ({ page }) => {
  await openTweaks(page);
  await page.getByTestId('tweak-hiddenFiles').getByText('Mehr dazu').click();
  const closed = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(closed.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  await page
    .getByTestId('tweak-animations')
    .getByRole('switch', { name: 'Animationen in Fenstern' })
    .click();
  await page.getByRole('button', { name: 'Alle zurücksetzen' }).click();
  await expect(page.getByRole('dialog', { name: 'Alle zurücksetzen?' })).toBeVisible();
  const dialog = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(dialog.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
