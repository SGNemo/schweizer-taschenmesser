import { expect, test } from '@playwright/test';
import { ready, calendarEntry } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
const NOW = new Date('2026-09-29T10:00:00');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test.describe('ToDos', () => {
  test('lists, tasks, priority, due date and subtasks', async ({ page }) => {
    await ready(page, '/todos');
    await expect(page.getByText('Nichts zu tun – gut so.')).toBeVisible();

    await page.getByRole('textbox', { name: 'ToDo hinzufügen' }).fill('Steuererklärung');
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Steuererklärung' })).toBeVisible();

    // Edit: priority, due date, subtask
    await page.getByRole('button', { name: /Steuererklärung/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Aufgabe bearbeiten' });
    await dialog.getByLabel('Priorität').selectOption('3');
    await dialog.getByLabel('Fällig am').fill('2026-09-30');
    await dialog.getByLabel('Unteraufgabe hinzufügen').fill('Belege sortieren');
    await dialog.getByLabel('Unteraufgabe hinzufügen').press('Enter');
    await expect(dialog.getByRole('checkbox', { name: 'Belege sortieren' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0); // write is done once the dialog closed

    const row = page.getByRole('button', { name: /Steuererklärung/ });
    await expect(row).toContainText('Hoch');
    await expect(row).toContainText('Morgen');
    await expect(row).toContainText('0/1');
    await expect(page.getByRole('checkbox', { name: 'Belege sortieren' })).toBeVisible();

    await page.getByRole('checkbox', { name: 'Belege sortieren' }).click();
    await expect(page.getByRole('button', { name: /Steuererklärung/ })).toContainText('1/1');
  });

  test('a new list scopes the tasks; deleting a task removes it', async ({ page }) => {
    await ready(page, '/todos');
    await page.getByRole('button', { name: 'Neue Liste' }).click();
    await page.getByLabel('Listenname').fill('Haushalt');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('button', { name: 'Haushalt', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    );

    await page.getByRole('textbox', { name: 'ToDo hinzufügen' }).fill('Fenster putzen');
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Fenster putzen' })).toBeVisible();

    await page.getByRole('button', { name: 'Eingang', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Fenster putzen' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Alle offenen' }).click();
    await expect(page.getByRole('checkbox', { name: 'Fenster putzen' })).toBeVisible();

    await page.getByRole('button', { name: /Fenster putzen/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
    await expect(page.getByRole('checkbox', { name: 'Fenster putzen' })).toHaveCount(0);
  });
});

test.describe('Reminders', () => {
  test('creates a monthly "every 1st" reminder and shows the next occurrence', async ({ page }) => {
    await ready(page, '/calendar?tab=reminders&new=1');
    const dialog = page.getByRole('dialog', { name: 'Erinnerung hinzufügen' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Titel').fill('Miete überweisen');
    await dialog.getByLabel('Datum').fill('2026-10-01');
    await dialog.getByLabel('Beginn').fill('08:00');
    await dialog.getByLabel('Wiederholung').selectOption('monthly');
    await dialog.getByLabel('Tag des Monats').selectOption('1');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0); // write is done once the dialog closed

    const card = page.getByRole('listitem').filter({ hasText: 'Miete überweisen' });
    await expect(card).toContainText('Jeden 1. des Monats');
    await expect(card).toContainText('Do., 1. Okt. 2026 · 08:00');
  });

  test('pausing keeps the reminder but removes it from the calendar', async ({ page }) => {
    await ready(page, '/calendar?tab=reminders&new=1');
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Titel').fill('Wasser trinken');
    await dialog.getByLabel('Datum').fill('2026-09-30');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0); // write is done once the dialog closed

    await ready(page, '/calendar?view=week&date=2026-09-30');
    await expect(calendarEntry(page, /Wasser trinken/)).toBeVisible();

    await ready(page, '/calendar?tab=reminders');
    await page.getByRole('switch', { name: /Wasser trinken/ }).click();
    await expect(page.getByText('Pausiert')).toBeVisible();
    await ready(page, '/calendar?view=week&date=2026-09-30');
    await expect(calendarEntry(page, /Wasser trinken/)).toHaveCount(0);
  });
});

test.describe('Calendar', () => {
  test('creates an event, shows it in all views and aggregates other modules', async ({ page }) => {
    // A task due today and a reminder today
    await ready(page, '/todos');
    await page.getByRole('textbox', { name: 'ToDo hinzufügen' }).fill('Paket abholen');
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
    await page.getByRole('button', { name: /Paket abholen/ }).click();
    await page.getByLabel('Fällig am').fill('2026-09-29');
    await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0); // write is done once the dialog closed
    await expect(page.getByRole('button', { name: /Paket abholen/ })).toContainText('Heute');

    await ready(page, '/calendar?tab=reminders&new=1');
    await page.getByLabel('Titel').fill('Blumen gießen');
    await page.getByLabel('Datum').fill('2026-09-29');
    await page.getByLabel('Beginn').fill('18:00');
    await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0); // write is done once the dialog closed
    await expect(calendarEntry(page, /Blumen gießen/)).toBeVisible();

    // Event via quick-add route
    await ready(page, '/calendar?new=1');
    const dialog = page.getByRole('dialog', { name: 'Neuer Termin' });
    await dialog.getByLabel('Titel').fill('Zahnarzt');
    await dialog.getByLabel('Beginn').fill('14:30');
    await dialog.getByLabel('Ort').fill('Praxis Dr. Meier');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0); // write is done once the dialog closed

    // Day view: all three sources, sorted (all-day task first, then by time)
    await ready(page, '/calendar?view=day&date=2026-09-29');
    const rows = page
      .locator('ul[class*="itemList"] > li')
      .and(page.locator('xpath=//*[not(ancestor::aside)]'));
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Paket abholen');
    await expect(rows.nth(1)).toContainText('14:30');
    await expect(rows.nth(1)).toContainText('Zahnarzt');
    await expect(rows.nth(2)).toContainText('18:00');
    await expect(rows.nth(2)).toContainText('Blumen gießen');

    // Week view and navigation
    await page.getByRole('button', { name: 'Woche' }).click();
    await expect(page.getByRole('heading', { name: /KW 40/ })).toBeVisible();
    await expect(calendarEntry(page, /Zahnarzt/)).toBeVisible();
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByRole('heading', { name: /KW 41/ })).toBeVisible();
    await expect(calendarEntry(page, /Zahnarzt/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Heute', exact: true }).click();
    await expect(page.getByRole('heading', { name: /KW 40/ })).toBeVisible();

    // Month view header
    await page.getByRole('button', { name: 'Monat' }).click();
    await expect(page.getByRole('heading', { name: 'September 2026' })).toBeVisible();
    await expect(page.getByRole('button', { name: /29\. September, 3 Einträge/ })).toBeVisible();
  });

  test('edits and deletes an event; recurring events repeat', async ({ page }) => {
    await ready(page, '/calendar?new=1&view=week&date=2026-09-29');
    const dialog = page.getByRole('dialog', { name: 'Neuer Termin' });
    await dialog.getByLabel('Titel').fill('Sport');
    await dialog.getByLabel('Wiederholung').selectOption('weekly');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0); // write is done once the dialog closed

    await expect(calendarEntry(page, /Sport/)).toHaveCount(1);
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(calendarEntry(page, /Sport/)).toHaveCount(1); // next week again

    await calendarEntry(page, /Sport/).click();
    await page
      .getByRole('dialog', { name: 'Termin bearbeiten' })
      .getByLabel('Titel')
      .fill('Sport im Park');
    await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0); // write is done once the dialog closed
    await expect(calendarEntry(page, /Sport im Park/)).toBeVisible();

    await calendarEntry(page, /Sport im Park/).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
    await expect(calendarEntry(page, /Sport/)).toHaveCount(0);
  });

  test('rejects an end date before the start', async ({ page }) => {
    await ready(page, '/calendar?new=1');
    const dialog = page.getByRole('dialog', { name: 'Neuer Termin' });
    await dialog.getByLabel('Titel').fill('Reise');
    await dialog.getByLabel('Ende (Datum)').fill('2026-09-01');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog.getByRole('alert')).toHaveText(
      'Das Ende darf nicht vor dem Beginn liegen.',
    );
  });
});

test.describe('Dashboard', () => {
  test('"Heute & Morgen" shows today and tomorrow across modules', async ({ page }) => {
    await ready(page, '/calendar?new=1');
    await page.getByLabel('Titel').fill('Teammeeting');
    await page.getByLabel('Beginn').fill('09:30');
    await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0); // write is done once the dialog closed
    await ready(page, '/todos');
    await page.getByRole('textbox', { name: 'ToDo hinzufügen' }).fill('Bericht senden');
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
    await page.getByRole('button', { name: /Bericht senden/ }).click();
    await page.getByLabel('Fällig am').fill('2026-09-30');
    await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0); // write is done once the dialog closed

    await ready(page, '/');
    const widget = page.getByTestId('widget-calendar:today');
    // "Heute" is a timeline now (the widget is large by default, so tomorrow follows below it).
    await expect(widget).toContainText('Teammeeting');
    await expect(widget.getByRole('heading', { name: 'Morgen', exact: true })).toBeVisible();
    await expect(widget).toContainText('Bericht senden');
    await expect(page.getByTestId('widget-todos:open')).toContainText('1 offen');
  });

  test('widgets can be hidden and the choice persists', async ({ page }) => {
    await ready(page, '/');
    await page.getByRole('button', { name: 'Anpassen' }).click();
    await page.getByTestId('widget-todos:open').getByRole('button', { name: 'Ausblenden' }).click();
    await expect(page.getByTestId('widget-todos:open')).toContainText('Ausgeblendet');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.getByTestId('widget-todos:open')).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId('widget-calendar:today')).toBeVisible();
    await expect(page.getByTestId('widget-todos:open')).toHaveCount(0);

    // Show again
    await page.getByRole('button', { name: 'Anpassen' }).click();
    await page.getByTestId('widget-todos:open').getByRole('button', { name: 'Einblenden' }).click();
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.getByTestId('widget-todos:open')).toBeVisible();
  });

  test('widgets can be reordered with the keyboard and the order persists', async ({ page }) => {
    const order = () =>
      page
        .locator('[data-testid^="widget-"]')
        .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.testid));
    await ready(page, '/');
    await expect(page.getByTestId('widget-finance:balance')).toBeVisible();
    const before = await order();
    expect(before).toEqual([
      'widget-todos:next',
      'widget-calendar:next',
      'widget-calendar:today',
      'widget-todos:open',
      'widget-finance:balance',
      'widget-invoices:due',
      'widget-subscriptions:next',
    ]);

    await page.getByRole('button', { name: 'Anpassen' }).click();
    const handle = page.getByRole('button', { name: 'Kontostand verschieben' });
    await handle.focus();
    // dnd-kit announces every step in a live region; waiting for it keeps the keyboard steps reliable.
    const live = page.locator('[id^="DndLiveRegion"]');
    await page.keyboard.press('Space');
    await expect(live).toContainText('Position 5 verschoben'); // picked up (starts at position 5)
    // dnd-kit needs a moment to measure the drop targets; keep pressing until the item moved.
    await expect(async () => {
      await page.keyboard.press('ArrowUp');
      await expect(live).not.toContainText('Position 5', { timeout: 500 });
    }).toPass();
    await page.keyboard.press('Space');
    await expect(live).toContainText('abgelegt');

    await expect.poll(order).not.toEqual(before);
    const after = await order();
    expect(after.indexOf('widget-finance:balance')).toBeLessThan(
      before.indexOf('widget-finance:balance'),
    );

    await page.getByRole('button', { name: 'Fertig' }).click();
    await page.reload();
    await expect(page.getByTestId('widget-finance:balance')).toBeVisible();
    expect(await order()).toEqual(after);
  });
});
