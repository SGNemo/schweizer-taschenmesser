import { expect, test, type Page } from '@playwright/test';
import { enable, ready } from './helpers';

async function addTodo(page: Page, title: string) {
  await ready(page, '/todos');
  await page.getByLabel('ToDo hinzufügen').fill(title);
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
}

test.describe('Visible progress without pressure', () => {
  test('a routine template creates a checklist with small steps', async ({ page }) => {
    await enable(page, 'lists');
    await ready(page, '/lists');
    await page.getByRole('button', { name: 'Aus Vorlage' }).click();
    await page.getByRole('button', { name: 'Morgenroutine' }).click();
    await expect(page.getByText('Liste angelegt.')).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Morgenroutine' }).getByRole('listitem'),
    ).toHaveCount(6);
    await expect(
      page.getByRole('navigation').getByText('Morgenroutine', { exact: true }),
    ).toBeVisible();
  });

  test('the week review is positive, and ticking something off updates it', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
    await addTodo(page, 'Steuerbeleg suchen');
    await ready(page, '/');
    const review = page.getByTestId('week-review');
    await expect(review).toContainText('Noch nichts erledigt');
    await page.getByRole('button', { name: 'Aus den offenen wählen' }).click();
    await page.getByRole('button', { name: 'Einplanen' }).click();
    await page.keyboard.press('Escape');
    await page
      .getByTestId('day-plan')
      .getByRole('checkbox', { name: 'Steuerbeleg suchen' })
      .click();
    await expect(review).toContainText('1 Aufgabe erledigt');
    await expect(review).toContainText('1 mehr als in der Woche davor');
  });

  test('in the evening "Tag abschließen" moves what is left to tomorrow; morning has no such card', async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
    await addTodo(page, 'Wäsche aufhängen');
    await ready(page, '/');
    await expect(page.getByTestId('wrap-up')).toHaveCount(0);

    await page.getByRole('button', { name: 'Aus den offenen wählen' }).click();
    await page.getByRole('button', { name: 'Einplanen' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('day-plan')).toContainText('Wäsche aufhängen');

    await page.clock.setFixedTime(new Date('2026-09-29T18:30:00'));
    await ready(page, '/');
    const wrap = page.getByTestId('wrap-up');
    await expect(wrap).toContainText('Eine Sache ist noch offen.');
    await wrap.getByRole('button', { name: 'Auf morgen schieben' }).click();
    await expect(page.getByText('Auf morgen geschoben. Schönen Abend!')).toBeVisible();
    await expect(wrap).toContainText('Alles für heute erledigt');
  });

  test('every aid has a switch in Settings and goes away when it is off', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
    await addTodo(page, 'Etwas Kleines');
    await ready(page, '/settings/darstellung');
    for (const name of ['Rückblick auf die Woche', '„n in Folge“ bei Wiederholungen']) {
      const sw = page.getByRole('switch', { name });
      await expect(sw).toHaveAttribute('aria-checked', 'true');
    }
    await page.getByRole('switch', { name: 'Rückblick auf die Woche' }).click();
    await ready(page, '/');
    await expect(page.getByTestId('week-review')).toHaveCount(0);
  });
});
