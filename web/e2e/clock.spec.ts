import { expect, test, type Page } from '@playwright/test';
import { enable, showAllWidgets, showPreview } from './helpers';

/**
 * Uhr (preview module): add a place offline, see it on the overview with its offset, rename it, open the module from
 * the clock next to the logo, and no horizontal overflow on a 412 px phone.
 */
test.use({ timezoneId: 'Europe/Berlin' });

test.beforeEach(async ({ page }) => {
  // 22:30 in Berlin in winter: 06:30 tomorrow in Tokyo (+8 h), 16:30 today in New York (−6 h).
  await page.clock.setFixedTime(new Date('2026-01-15T22:30:00+01:00'));
  await showPreview(page);
  await showAllWidgets(page);
});

async function addPlace(page: Page, query: string, hit: string) {
  await page.goto('/clock?new=1');
  const dialog = page.getByRole('dialog', { name: 'Ort eintragen' });
  await dialog.getByLabel('Stadt oder Zeitzone').fill(query);
  await dialog.getByTestId('clock-hit').filter({ hasText: hit }).first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('a place added by search shows on the page and on the overview with its offset', async ({
  page,
}) => {
  await enable(page, 'clock');
  // A typo still finds Tokyo: the search is offline and forgiving.
  await addPlace(page, 'Tokoi', 'Tokio');
  const row = page.getByTestId('clock-place').filter({ hasText: 'Tokio' });
  await expect(row).toContainText('06:30');
  await expect(row).toContainText('morgen · +8 h');
  await expect(row).toContainText('Tag');
  await expect(row).toContainText('Asia/Tokyo');
  await expect(page.getByTestId('clock-here')).toHaveText('22:30');

  await page.goto('/');
  const tile = page.getByTestId('widget-clock:places');
  await expect(tile).toContainText('Tokio');
  await expect(tile).toContainText('06:30');
  await expect(tile).toContainText('Tag · morgen · +8 h');
});

test('a place gets its own name; removing it can be undone', async ({ page }) => {
  await enable(page, 'clock');
  await addPlace(page, 'New York', 'New York');
  const row = page.getByTestId('clock-place');
  await expect(row).toContainText('16:30');
  await expect(row).toContainText('−6 h');

  await row.getByRole('button', { name: 'Aktionen für New York' }).click();
  await page.getByRole('menuitem', { name: 'Umbenennen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ort umbenennen' });
  await dialog.getByLabel('Name').fill('Tante Ines');
  await dialog.getByRole('button', { name: /^(Speichern|.+ eintragen)$/ }).click();
  await expect(row).toContainText('Tante Ines');

  await row.getByRole('button', { name: 'Aktionen für Tante Ines' }).click();
  await page.getByRole('menuitem', { name: /Entfernen/ }).click();
  await expect(page.getByTestId('clock-empty')).toBeVisible();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByTestId('clock-place')).toContainText('Tante Ines');
});

test('"Erinnern um …" turns a time in Tokyo into a calendar reminder at the local time', async ({
  page,
}) => {
  await enable(page, 'clock');
  await addPlace(page, 'Tokio', 'Tokio');
  const row = page.getByTestId('clock-place');
  await row.getByRole('button', { name: 'Aktionen für Tokio' }).click();
  await page.getByRole('menuitem', { name: 'Erinnern um …' }).click();
  const dialog = page.getByRole('dialog', { name: 'Erinnern nach der Zeit in Tokio' });
  // Starts at the next full hour there: 07:00 tomorrow in Tokyo.
  await expect(dialog.getByLabel('Uhrzeit in Tokio')).toHaveValue('07:00');
  await dialog.getByLabel('Woran erinnern?').fill('Mama anrufen');
  await dialog.getByLabel('Datum in Tokio').fill('2026-01-16');
  await dialog.getByLabel('Uhrzeit in Tokio').fill('19:00');
  // 19:00 in Tokyo in January is 11:00 in Berlin (+8 h), the same day.
  await expect(dialog.getByTestId('clock-remind-here')).toContainText('Bei dir:');
  await expect(dialog.getByTestId('clock-remind-here')).toContainText('11:00');
  await dialog.getByRole('button', { name: 'Erinnerung anlegen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/Erinnerung für .* 11:00 angelegt\./)).toBeVisible();

  await page.goto('/calendar?tab=reminders');
  const entry = page.getByRole('button', { name: /Mama anrufen \(19:00 in Tokio\)/ });
  await expect(entry).toBeVisible();
  await entry.click();
  const editor = page.getByRole('dialog');
  await expect(editor.getByLabel('Beginn')).toHaveValue('11:00');
});

test('a reminder from the clock can be undone; a past time cannot be saved', async ({ page }) => {
  await enable(page, 'clock');
  await addPlace(page, 'New York', 'New York');
  await page.getByRole('button', { name: 'Aktionen für New York' }).click();
  await page.getByRole('menuitem', { name: 'Erinnern um …' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Woran erinnern?').fill('Anrufen');
  // 16:30 in New York now: 10:00 today there has passed.
  await dialog.getByLabel('Datum in New York').fill('2026-01-15');
  await dialog.getByLabel('Uhrzeit in New York').fill('10:00');
  await expect(dialog.getByTestId('clock-remind-here')).toHaveText(
    'Dieser Zeitpunkt ist schon vorbei.',
  );
  await expect(dialog.getByRole('button', { name: 'Erinnerung anlegen' })).toBeDisabled();
  await dialog.getByLabel('Uhrzeit in New York').fill('18:00');
  await dialog.getByRole('button', { name: 'Erinnerung anlegen' }).click();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByText('Rückgängig gemacht.')).toBeVisible();
  await page.goto('/calendar?tab=reminders');
  await expect(page.getByText(/Anrufen \(/)).toHaveCount(0);
});

test("the page's ⋯ opens the Timer tool, no second timer", async ({ page }) => {
  await enable(page, 'clock');
  await page.goto('/clock');
  await page.getByRole('button', { name: 'Mehr zur Uhr' }).click();
  await page.getByRole('menuitem', { name: 'Timer' }).click();
  await expect(page.getByRole('dialog', { name: 'Timer' })).toBeVisible();
  await expect(page).toHaveURL(/\/clock$/);
});

test('the clock next to the logo opens the module while it is on', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => localStorage.setItem('tm-clock', '1'));
  await page.goto('/');
  // Module off: the time is no link.
  await expect(page.getByTestId('sidebar').getByTestId('logo-clock')).toBeVisible();
  await expect(page.getByTestId('logo-clock-link')).toHaveCount(0);
  await enable(page, 'clock');
  await page.goto('/');
  const link = page.getByTestId('sidebar').getByTestId('logo-clock-link');
  await expect(link).toHaveAccessibleName('Uhr öffnen, 22:30');
  await link.click();
  await expect(page).toHaveURL(/\/clock$/);
  await expect(page.locator('main h1')).toHaveText('Uhr');
});

test.describe('phone (412 px)', () => {
  test.use({ viewport: { width: 412, height: 915 } });

  test('long names and many places fit without horizontal overflow', async ({ page }) => {
    await enable(page, 'clock');
    await addPlace(page, 'Kapstadt', 'Kapstadt');
    await addPlace(page, 'Asia/Kolkata', 'Kolkata');
    const row = page.getByTestId('clock-place').first();
    await row.getByRole('button', { name: /Aktionen für/ }).click();
    await page.getByRole('menuitem', { name: 'Umbenennen' }).click();
    await page
      .getByRole('dialog')
      .getByLabel('Name')
      .fill('Ferienwohnung der Familie am Kap der Guten Hoffnung');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^(Speichern|.+ eintragen)$/ })
      .click();
    await expect(page.getByTestId('clock-place')).toHaveCount(2);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    for (const r of await page.getByTestId('clock-place').all()) {
      const box = (await r.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(412);
    }
    // The reminder dialog fits too: day and time stack, the preview line wraps.
    await page.getByRole('button', { name: /Aktionen für Kolkata/ }).click();
    await page.getByRole('menuitem', { name: 'Erinnern um …' }).click();
    await expect(page.getByTestId('clock-remind-here')).toContainText('Bei dir:');
    const dialogOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(dialogOverflow).toBeLessThanOrEqual(0);
    await page.keyboard.press('Escape');

    await page.goto('/');
    const tile = page.getByTestId('widget-clock:places');
    await expect(tile).toContainText('+4:30 h');
    const width = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(width).toBeLessThanOrEqual(0);
  });
});
