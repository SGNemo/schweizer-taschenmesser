import { expect, test, type Page } from '@playwright/test';
import { enable } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-03T10:00:00'));
});

async function addJob(page: Page, name: string, rate: string) {
  await page.goto('/timetrack?view=jobs');
  await page.getByRole('button', { name: 'Projekt hinzufügen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Projekt hinzufügen' });
  await dialog.getByLabel('Name', { exact: true }).fill(name);
  await dialog.getByLabel('Stundensatz (€)').fill(rate);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test.describe('Time tracking (plan group, new module)', () => {
  test('one click starts the timer, Stopp ends it and the session shows in the day', async ({
    page,
  }) => {
    await enable(page, 'timetrack');
    await addJob(page, 'Website', '60');
    await page.goto('/timetrack');
    await page.getByRole('button', { name: 'Website starten' }).click();
    const card = page.getByTestId('running-card');
    await expect(card).toContainText('Website');
    await expect(card).toContainText('seit');
    await card.getByRole('button', { name: 'Pause' }).click();
    await expect(card.getByRole('button', { name: 'Weiter' })).toBeVisible();
    await card.getByRole('button', { name: 'Weiter' }).click();
    await card.getByRole('button', { name: 'Stopp' }).click();
    await expect(page.getByTestId('running-card')).toHaveCount(0);
    await expect(page.getByText('Nichts läuft.')).toBeVisible();
  });

  test('a manual entry flows into the report with the amount', async ({ page }) => {
    await enable(page, 'timetrack');
    await addJob(page, 'Website', '60');
    await page.goto('/timetrack?new=1');
    const dialog = page.getByRole('dialog', { name: 'Zeit eintragen' });
    await dialog.getByLabel('Beginn').fill('08:00');
    await dialog.getByLabel('Ende', { exact: true }).fill('10:30');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Auswertung', exact: true }).click();
    await expect(page.getByTestId('report-total')).toHaveText('2 Std 30 Min');
    await expect(page.getByTestId('report-amount')).toContainText('150,00');
  });
});
