import { expect, test, type Page } from '@playwright/test';
import { ready, showAllWidgets } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function addEvent(page: Page, title: string, date: string, time: string) {
  await ready(page, '/calendar?new=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titel').fill(title);
  await dialog.getByLabel('Datum', { exact: true }).fill(date);
  await dialog.getByLabel('Beginn').fill(time);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test.describe('Home: Heute · Morgen · diese Woche (QA V03/B18)', () => {
  test('an empty week says so in one line and names the next step', async ({ page }) => {
    await showAllWidgets(page);
    await ready(page, '/');
    const block = page.getByTestId('agenda');
    await expect(block).toContainText('In den nächsten Tagen steht nichts an.');
    await expect(block.getByRole('link', { name: 'Termin eintragen' })).toBeVisible();
  });

  test('appointments of today, tomorrow and later this week sit in one block of the detailed view', async ({
    page,
  }) => {
    await addEvent(page, 'Zahnarzt', '2026-09-29', '14:00');
    await addEvent(page, 'Elternabend', '2026-09-30', '19:00');
    await addEvent(page, 'Chor', '2026-10-02', '18:30');
    await addEvent(page, 'Später im Monat', '2026-10-20', '09:00');
    await showAllWidgets(page);
    await ready(page, '/');
    await expect(page.getByTestId('agenda-today')).toContainText('14:00');
    await expect(page.getByTestId('agenda-today')).toContainText('Zahnarzt');
    await expect(page.getByTestId('agenda-tomorrow')).toContainText('Elternabend');
    await expect(page.getByTestId('agenda-week')).toContainText('Chor');
    await expect(page.getByTestId('agenda')).not.toContainText('Später im Monat');
    await expect(page.getByTestId('agenda')).not.toContainText('nichts an');
    // The agenda lists the appointment, so "Jetzt wichtig" does not name it a second time.
    await expect(page.getByRole('region', { name: 'Jetzt wichtig' })).toHaveCount(0);
  });

  test('"Ruhig" is the default and shows no agenda: the "Heute" card names the day\'s appointments', async ({
    page,
  }) => {
    await addEvent(page, 'Zahnarzt', '2026-09-29', '14:00');
    await addEvent(page, 'Abendessen', '2026-09-29', '19:00');
    await addEvent(page, 'Elternabend', '2026-09-30', '19:00');
    await ready(page, '/');
    const today = page.getByTestId('widget-todos:next');
    await expect(today).toContainText('14:00 Zahnarzt');
    await expect(today.getByTestId('today-appointments')).toContainText('Abendessen');
    await expect(page.getByTestId('agenda')).toHaveCount(0);
    // Only the "Heute" card; and nothing of today stands on the page twice.
    await expect(page.getByTestId('widget-finance:balance')).toHaveCount(0);
    await expect(page.getByRole('main').getByText('Zahnarzt')).toHaveCount(1);
    await expect(page.getByRole('main')).not.toContainText('Elternabend');
  });

  test('"Ruhig" and "Ausführlich" switch on the page itself; the block belongs to the detailed view', async ({
    page,
  }) => {
    await addEvent(page, 'Zahnarzt', '2026-09-29', '14:00');
    await ready(page, '/');
    const density = page.getByRole('group', { name: 'Übersicht' });
    await expect(density.getByRole('button', { name: 'Ruhig' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await density.getByRole('button', { name: 'Ausführlich' }).click();
    await expect(page.getByTestId('widget-finance:balance')).toBeVisible();
    await expect(page.getByTestId('agenda-today')).toContainText('Zahnarzt');
    await page.reload();
    await expect(page.getByTestId('widget-finance:balance')).toBeVisible();
    await page
      .getByRole('group', { name: 'Übersicht' })
      .getByRole('button', { name: 'Ruhig' })
      .click();
    await expect(page.getByTestId('widget-finance:balance')).toHaveCount(0);
    await expect(page.getByTestId('agenda')).toHaveCount(0);
    await expect(page.getByTestId('widget-todos:next')).toContainText('Zahnarzt');
  });

  test('the block has a switch in the card sheet, and one that brings it into "Ruhig"', async ({
    page,
  }) => {
    await addEvent(page, 'Zahnarzt', '2026-09-29', '14:00');
    await ready(page, '/');
    await expect(page.getByTestId('agenda')).toHaveCount(0);
    await page.getByRole('button', { name: 'Anpassen' }).click();
    await page.getByRole('button', { name: 'Karten', exact: false }).first().click();
    await page
      .getByRole('switch', { name: '„Heute · Morgen · diese Woche“ auch in „Ruhig“' })
      .click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Fertig' }).click();
    // Pinned into the calm view: the block lists the appointment, the card no longer does.
    await expect(page.getByTestId('agenda-today')).toContainText('Zahnarzt');
    await expect(page.getByTestId('today-appointments')).toHaveCount(0);

    await page.getByRole('button', { name: 'Anpassen' }).click();
    await page.getByRole('button', { name: 'Karten', exact: false }).first().click();
    await page.getByRole('switch', { name: 'Heute · Morgen · diese Woche', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.getByTestId('agenda')).toHaveCount(0);
    await page
      .getByRole('group', { name: 'Übersicht' })
      .getByRole('button', { name: 'Ausführlich' })
      .click();
    await expect(page.getByTestId('widget-finance:balance')).toBeVisible();
    await expect(page.getByTestId('agenda')).toHaveCount(0);
  });
});
