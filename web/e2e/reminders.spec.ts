import { expect, test, type Page } from '@playwright/test';
import { openFoldedGroup, ready } from './helpers';

/** Creates a reminder for 20:00 on 2026-09-29 through the calendar's reminder dialog. */
async function addReminder(page: Page, title: string) {
  await page.goto('/calendar?tab=reminders&new=1');
  const dialog = page.getByRole('dialog', { name: 'Erinnerung hinzufügen' });
  await dialog.getByLabel('Titel').fill(title);
  await dialog.getByLabel('Datum').fill('2026-09-29');
  await dialog.getByLabel('Beginn').fill('20:00');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible();
}

/** The automatic in-app card is off by default; the tests of the card switch it on in the settings. */
async function enableCard(page: Page) {
  await page.goto('/settings/benachrichtigungen');
  await openFoldedGroup(page, 'calm-reminders', 'inApp');
  const card = page.getByRole('switch', { name: 'Erinnerungen in der App automatisch einblenden' });
  await expect(card).toHaveAttribute('aria-checked', 'false');
  await card.click();
  await expect(card).toHaveAttribute('aria-checked', 'true');
}

test.describe('Notification centre (manual reminders)', () => {
  test('no automatic banner; the bell counts, "Nächste Erinnerung" answers with Erledigt', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-09-29T19:59:00') });
    await addReminder(page, 'Tabletten nehmen');
    await page.clock.fastForward(90_000);
    // Time has come, but nothing pops up by itself.
    await page.clock.runFor(35_000);
    await expect(page.getByTestId('reminder-prompt')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const bell = page.getByTestId('notification-bell');
    await expect(bell).toHaveAccessibleName('Erinnerungen, 1 offen');
    await bell.click();
    const panel = page.getByRole('dialog', { name: 'Erinnerungen' });
    await panel.getByRole('button', { name: 'Nächste Erinnerung zeigen' }).click();
    const card = panel.getByTestId('center-card');
    await expect(card).toContainText('Tabletten nehmen');
    await card.getByRole('button', { name: 'Erledigt' }).click();
    await expect(panel.getByText('Keine offenen Erinnerungen.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(bell).toBeFocused();
    await expect(bell).toHaveAccessibleName('Erinnerungen');
  });

  test('"Eine Erinnerung zeigen" is reachable from the command palette', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-29T19:59:00') });
    await addReminder(page, 'Wäsche aufhängen');
    await page.clock.fastForward(120_000);
    await page.getByRole('button', { name: 'Suchen' }).first().click();
    await page.getByRole('combobox').fill('Eine Erinnerung');
    await page.keyboard.press('Enter');
    const card = page.getByRole('dialog', { name: 'Erinnerungen' }).getByTestId('center-card');
    await expect(card).toContainText('Wäsche aufhängen');
  });
});

test.describe('Calm reminders', () => {
  test('a due reminder appears as a card in the app; Erledigt closes it', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-29T19:59:00') });
    await enableCard(page);
    await addReminder(page, 'Tabletten nehmen');
    await expect(page.getByTestId('reminder-prompt')).toHaveCount(0);

    await page.clock.fastForward(90_000);
    const card = page.getByTestId('reminder-prompt');
    await expect(card).toContainText('Tabletten nehmen');
    await card.getByRole('button', { name: 'Erledigt' }).click();
    await expect(card).toHaveCount(0);
    // The same occurrence never comes back.
    await page.clock.fastForward(120_000);
    await expect(page.getByTestId('reminder-prompt')).toHaveCount(0);
  });

  test('"Später" brings the reminder back at the chosen time', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-29T19:59:00') });
    await enableCard(page);
    await addReminder(page, 'Wäsche aufhängen');
    await page.clock.fastForward(90_000);
    const card = page.getByTestId('reminder-prompt');
    await card.getByRole('button', { name: 'Später' }).click();
    await expect(card.getByRole('button', { name: 'Heute Abend' })).toHaveCount(0); // it is evening already
    await card.getByRole('button', { name: 'In 1 Std' }).click();
    await expect(page.getByText('Okay, in einer Stunde.')).toBeVisible();
    await expect(page.getByTestId('reminder-prompt')).toHaveCount(0);

    await page.clock.runFor(30 * 60_000);
    await expect(page.getByTestId('reminder-prompt')).toHaveCount(0);
    await page.clock.runFor(35 * 60_000); // 20:00:30 + 65 min
    await expect(page.getByTestId('reminder-prompt')).toContainText('Wäsche aufhängen');
  });

  test('an unanswered reminder comes back every 30 minutes until "Erledigt"', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-29T19:59:00') });
    await enableCard(page);
    await addReminder(page, 'Wäsche aufhängen');
    await page.clock.fastForward(90_000); // 20:00:30
    const card = page.getByTestId('reminder-prompt');
    await expect(card).toContainText('Wäsche aufhängen');
    await expect(card).not.toContainText('Noch offen');

    await page.clock.runFor(30 * 60_000); // 20:30
    await expect(card).toContainText('Noch offen: Wäsche aufhängen');
    await page.clock.runFor(30 * 60_000); // 21:00, the card is replaced, not stacked
    await expect(card).toContainText('Noch offen: Wäsche aufhängen');
    await expect(card).not.toContainText('weitere');

    await card.getByRole('button', { name: 'Erledigt' }).click();
    await expect(page.getByTestId('reminder-prompt')).toHaveCount(0);
    await page.clock.runFor(60 * 60_000); // would be 21:30 and 22:00
    await expect(page.getByTestId('reminder-prompt')).toHaveCount(0);
  });

  test('"Später" on a repeat ends the series and keeps the reminder\'s own title', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-09-29T19:59:00') });
    await enableCard(page);
    await addReminder(page, 'Wäsche aufhängen');
    await page.clock.fastForward(90_000);
    await page.clock.runFor(30 * 60_000); // 20:30, the first repeat
    const card = page.getByTestId('reminder-prompt');
    await expect(card).toContainText('Noch offen: Wäsche aufhängen');
    await card.getByRole('button', { name: 'Später' }).click();
    await card.getByRole('button', { name: 'In 1 Std' }).click();
    await expect(page.getByTestId('reminder-prompt')).toHaveCount(0);

    await page.clock.runFor(35 * 60_000); // 21:05: no further repeat
    await expect(page.getByTestId('reminder-prompt')).toHaveCount(0);
    await page.clock.runFor(30 * 60_000); // 21:35: the snoozed reminder, under its own title
    const again = page.getByTestId('reminder-prompt');
    await expect(again).toContainText('Wäsche aufhängen');
    await expect(again).not.toContainText('Noch offen');
  });

  test('the repeat can be switched off in the settings', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-29T19:59:00') });
    await enableCard(page);
    const section = page.locator('section[aria-labelledby="calm-reminders"]');
    await openFoldedGroup(page, 'calm-reminders', 'followUp');
    const repeat = section.getByRole('switch', { name: 'Ruhig wiederholen' });
    await expect(repeat).toHaveAttribute('aria-checked', 'true');
    await repeat.click();
    await expect(repeat).toHaveAttribute('aria-checked', 'false');
    await addReminder(page, 'Wäsche aufhängen');
    await page.clock.fastForward(90_000);
    const card = page.getByTestId('reminder-prompt');
    await expect(card).toContainText('Wäsche aufhängen');
    await page.clock.runFor(35 * 60_000);
    await expect(card).not.toContainText('Noch offen');
  });

  test('settings: quiet hours, limit, stages and morning ToDos can be changed and survive a reload', async ({
    page,
  }) => {
    await ready(page, '/settings/benachrichtigungen');
    const section = page.locator('section[aria-labelledby="calm-reminders"]');
    await expect(section).toBeVisible();
    for (const id of ['quiet', 'limit', 'staggered', 'followUp', 'digest']) {
      await openFoldedGroup(page, 'calm-reminders', id);
    }
    const quiet = section.getByRole('switch', { name: 'Ruhezeit' });
    await expect(quiet).toHaveAttribute('aria-checked', 'true');
    await expect(section.getByLabel('Von')).toHaveValue('22:00');

    await section.getByLabel('Von').fill('21:30');
    await section.getByRole('button', { name: '5', exact: true }).click();
    const staggered = section.getByRole('switch', { name: 'Gestaffelte Erinnerung' });
    await staggered.click();
    await section.getByRole('button', { name: '1 Tag' }).click();
    await section.getByRole('switch', { name: 'Ruhig wiederholen' }).click();
    await section.getByRole('switch', { name: 'ToDos am Morgen' }).click();
    await expect(section.getByLabel('Uhrzeit der Übersicht')).toHaveCount(0);

    await page.reload();
    const again = page.locator('section[aria-labelledby="calm-reminders"]');
    await expect(again).toBeVisible();
    for (const id of ['quiet', 'limit', 'staggered', 'followUp', 'digest']) {
      await openFoldedGroup(page, 'calm-reminders', id);
    }
    await expect(again.getByLabel('Von')).toHaveValue('21:30');
    await expect(again.getByRole('button', { name: '5', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(again.getByRole('button', { name: '1 Tag' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(again.getByRole('switch', { name: 'Ruhig wiederholen' })).toHaveAttribute(
      'aria-checked',
      'false', // on by default, switched off above
    );
    await expect(again.getByLabel('Abstand')).toHaveCount(0);
    await expect(again.getByRole('switch', { name: 'ToDos am Morgen' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  test('"Woran war ich?" offers the way back after a break and can be declined', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-09-29T10:00:00') });
    await ready(page, '/todos');
    await page.clock.runFor(1000); // the tracker notes the place and its title
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.runFor(1000);
    await page.clock.fastForward(40 * 60_000);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.getByRole('link', { name: 'Zur Übersicht' }).click();
    const card = page.getByTestId('resume-card');
    await expect(card).toContainText('Zuletzt: ToDos');
    await card.getByRole('button', { name: 'Nein, danke' }).click();
    await expect(card).toHaveCount(0);
  });

  test('has no accessibility violations on the new settings section', async ({ page }) => {
    const { default: AxeBuilder } = await import('@axe-core/playwright');
    await ready(page, '/settings/benachrichtigungen');
    await expect(page.locator('section[aria-labelledby="calm-reminders"]')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
