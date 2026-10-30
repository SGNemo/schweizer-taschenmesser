import { expect, test } from '@playwright/test';
import { enable, ready } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

test.describe('"Für" – a person or client on appointments and ToDos (QA V14)', () => {
  test('no field and no filter without people', async ({ page }) => {
    await ready(page, '/calendar?new=1');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Titel')).toBeVisible();
    await expect(dialog.getByLabel('Für', { exact: true })).toHaveCount(0);
  });

  test('assign an appointment and a ToDo, see the name, filter by person', async ({ page }) => {
    await enable(page, 'people');
    for (const name of ['Lena', 'Müller GmbH']) {
      await ready(page, '/people?new=1');
      const person = page.getByRole('dialog');
      await person.getByLabel('Name', { exact: true }).fill(name);
      await person.getByRole('checkbox', { name: 'Geburtstag eintragen' }).uncheck();
      await person.getByRole('button', { name: 'Speichern' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }

    await ready(page, '/calendar?new=1');
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Titel').fill('Zahnarzt');
    await dialog.getByLabel('Datum', { exact: true }).fill('2026-09-29');
    await dialog.getByLabel('Beginn').fill('15:00');
    await dialog.getByLabel('Für', { exact: true }).selectOption({ label: 'Lena' });
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await ready(page, '/calendar?new=1');
    await page.getByRole('dialog').getByLabel('Titel').fill('Workshop');
    await page.getByRole('dialog').getByLabel('Datum', { exact: true }).fill('2026-09-29');
    await page.getByRole('dialog').getByLabel('Beginn').fill('10:00');
    await page
      .getByRole('dialog')
      .getByLabel('Für', { exact: true })
      .selectOption({ label: 'Müller GmbH' });
    await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Day view: both entries, the name next to the title.
    await ready(page, '/calendar?view=day&date=2026-09-29');
    await expect(page.getByText('für Lena').first()).toBeVisible();
    await expect(page.getByText('für Müller GmbH').first()).toBeVisible();

    // The filter narrows the day to one person.
    await page.getByLabel('Für wen').selectOption({ label: 'Lena' });
    await expect(page).toHaveURL(/for=/);
    await expect(page.getByText('Zahnarzt').first()).toBeVisible();
    await expect(page.getByText('Workshop')).toHaveCount(0);
  });

  test('a ToDo can be for a person: the name shows in the list and the filter narrows it', async ({
    page,
  }) => {
    await enable(page, 'people');
    await ready(page, '/people?new=1');
    const person = page.getByRole('dialog');
    await person.getByLabel('Name', { exact: true }).fill('Lena');
    await person.getByRole('checkbox', { name: 'Geburtstag eintragen' }).uncheck();
    await person.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    for (const title of ['Zahnarzt anrufen', 'Müll rausbringen']) {
      await ready(page, '/todos');
      await page.getByLabel('ToDo hinzufügen').fill(title);
      await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    }
    await page.getByRole('button', { name: /Zahnarzt anrufen/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Für', { exact: true }).selectOption({ label: 'Lena' });
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('für Lena')).toBeVisible();

    await page.getByLabel('Für wen').selectOption({ label: 'Lena' });
    await expect(page.getByText('Zahnarzt anrufen').first()).toBeVisible();
    await expect(page.getByText('Müll rausbringen')).toHaveCount(0);
  });
});
