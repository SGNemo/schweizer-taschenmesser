import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function addTask(page: Page, title: string) {
  await ready(page, '/todos');
  await page.getByRole('textbox', { name: 'ToDo hinzufügen' }).fill(title);
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: title })).toBeVisible();
}

test.describe('ToDos: Wiederholung und Irgendwann', () => {
  test('ticking off a recurring task creates the next one', async ({ page }) => {
    await addTask(page, 'Müll rausbringen');
    await page.getByRole('button', { name: /Müll rausbringen/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Fällig am').fill('2026-09-29');
    await dialog.getByLabel('Wiederholung').selectOption('weekly');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Müll rausbringen/ })).toContainText('↻');

    await page.getByRole('checkbox', { name: 'Müll rausbringen' }).click();
    // Wait until the write is done (the toast comes after it), or the next page load aborts it.
    await expect(page.getByText('Als erledigt markiert.')).toBeVisible();
    // The ticked one is history; one open task with the next date remains.
    const open = page.getByRole('checkbox', { name: 'Müll rausbringen' });
    await expect(open).toHaveCount(1);
    await expect(open).not.toBeChecked();

    // Both occurrences show on the calendar of that week and the next.
    await ready(page, '/calendar?view=week&date=2026-10-06');
    await expect(page.getByText('Müll rausbringen').first()).toBeVisible();
  });

  test('"Irgendwann" keeps a task out of the open list until you look for it', async ({ page }) => {
    await addTask(page, 'Dachboden aufräumen');
    await page.getByRole('button', { name: /Dachboden aufräumen/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('switch', { name: /Irgendwann/ }).click();
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'Dachboden aufräumen' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Irgendwann', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Dachboden aufräumen' })).toBeVisible();
  });
});

test('a calendar event can notify before it starts', async ({ page }) => {
  await ready(page, '/calendar?new=1');
  const dialog = page.getByRole('dialog', { name: 'Neuer Termin' });
  await dialog.getByLabel('Titel').fill('Zahnarzt');
  await dialog.getByLabel('Beginn').fill('14:30');
  await dialog.getByLabel('Benachrichtigen').selectOption({ label: '15 Minuten vorher' });
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await ready(page, '/calendar?view=day&date=2026-09-29');
  await page
    .getByRole('button', { name: /Zahnarzt/ })
    .first()
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Termin bearbeiten' }).getByLabel('Benachrichtigen'),
  ).toHaveValue('15');
});
