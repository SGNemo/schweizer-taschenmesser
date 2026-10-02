import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

/** Creates a ToDo through the inline add field of the ToDos page. */
async function addTodo(page: Page, title: string) {
  await ready(page, '/todos');
  await page.getByLabel('ToDo hinzufügen').fill(title);
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
}

test.describe('Focus and attention aids', () => {
  test('home suggests one task; Anfangen opens the focus screen without menus; Fertig ticks it off', async ({
    page,
  }) => {
    await addTodo(page, 'Formular ausfüllen');
    await ready(page, '/');
    const card = page.getByTestId('next-card');
    await expect(card).toContainText('Formular ausfüllen');
    await card.getByRole('button', { name: /Anfangen · 25 Min/ }).click();

    await expect(page).toHaveURL(/\/todos\/focus\//);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Formular ausfüllen');
    await expect(page.getByRole('timer')).toContainText('25:00');
    // One thing only: no sidebar, no bottom navigation, no quick-add button.
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Schnell hinzufügen' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Erledigt. Gut gemacht.')).toBeVisible();
    await ready(page, '/todos');
    await expect(page.getByTestId('widget-todos:open')).toHaveCount(0);
  });

  test('a focus round survives a reload and leaving the screen; the indicator leads back', async ({
    page,
  }, info) => {
    await addTodo(page, 'Keller aufräumen');
    await ready(page, '/');
    await page
      .getByTestId('next-card')
      .getByRole('button', { name: /Anfangen/ })
      .click();
    await expect(page.getByRole('timer')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('timer')).toContainText(/2[45]:\d\d/);

    await page.getByRole('button', { name: 'Verlassen' }).click();
    await expect(page).toHaveURL(/\/$/);
    const indicator = page.getByTestId('focus-indicator');
    await expect(indicator).toBeVisible();
    await indicator.click();
    await expect(page).toHaveURL(/\/todos\/focus\//);
    await page.getByRole('button', { name: 'Runde beenden' }).click();
    await expect(page.getByText('Fokus beendet. Dein Stand ist gespeichert.')).toBeVisible();
    await expect(page.getByTestId('focus-indicator')).toHaveCount(0);
    void info;
  });

  test('Esc leaves the focus screen and the round keeps running', async ({ page }, info) => {
    test.skip(info.project.name === 'pixel-7', 'keyboard shortcut is a desktop feature');
    await addTodo(page, 'Mail beantworten');
    await ready(page, '/');
    await page
      .getByTestId('next-card')
      .getByRole('button', { name: /Anfangen/ })
      .click();
    await expect(page.getByRole('timer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('focus-indicator')).toBeVisible();
  });

  test('"Etwas anderes" shows the next suggestion; "Später" moves it to tomorrow with undo', async ({
    page,
  }) => {
    await addTodo(page, 'Erste Aufgabe');
    await addTodo(page, 'Zweite Aufgabe');
    await ready(page, '/');
    const card = page.getByTestId('next-card');
    const first = (await card.locator('span').nth(1).textContent()) ?? '';
    await card.getByRole('button', { name: 'Etwas anderes' }).click();
    await expect(page.getByTestId('next-card')).not.toContainText(first);
    await page.getByTestId('next-card').getByRole('button', { name: 'Später' }).click();
    await expect(page.getByText('Auf morgen verschoben.')).toBeVisible();
  });

  test('day plan: plan a ToDo for today in the editor, see it on the home screen', async ({
    page,
  }) => {
    await addTodo(page, 'Zahnbürsten kaufen');
    await ready(page, '/todos');
    await page.getByRole('button', { name: /Zahnbürsten kaufen/ }).click();
    await page.getByRole('button', { name: 'Für heute einplanen' }).click();
    await page.getByRole('button', { name: '15 Min' }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await ready(page, '/');
    const plan = page.getByTestId('day-plan');
    await expect(plan).toContainText('Zahnbürsten kaufen');
    await expect(plan).toContainText('15 Min');
    await expect(plan).toContainText('Noch Platz für 2.');
    await plan.getByRole('checkbox', { name: 'Zahnbürsten kaufen' }).click();
    await expect(plan).toContainText('Erledigt heute: 1');
  });

  test('old ToDos "wait" calmly: no red wording, and Neu planen spreads them out', async ({
    page,
  }) => {
    await addTodo(page, 'Alte Sache');
    await ready(page, '/todos');
    await page.getByRole('button', { name: /Alte Sache/ }).click();
    await page.getByLabel('Fällig am').fill('2026-09-01');
    await page.getByRole('button', { name: 'Speichern' }).click();

    await expect(page.getByTestId('todos-waiting')).toContainText('1 ToDo wartet noch.');
    await expect(page.getByText('Überfällig', { exact: false })).toHaveCount(0);
    await page.getByRole('button', { name: 'Neu planen' }).click();
    await expect(page.getByText('Auf die nächsten Tage verteilt.')).toBeVisible();
    await expect(page.getByTestId('todos-waiting')).toHaveCount(0);
  });

  test('every aid can be switched off in the settings', async ({ page }) => {
    await addTodo(page, 'Etwas');
    await ready(page, '/settings/darstellung');
    const section = page.locator('section[aria-labelledby="focus"]');
    await expect(section).toBeVisible();
    for (const name of ['Nächste eine Sache', 'Tagesplan']) {
      const toggle = section.getByRole('switch', { name });
      await expect(toggle).toHaveAttribute('aria-checked', 'true');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-checked', 'false');
    }
    await ready(page, '/');
    await expect(page.getByText('Die Vorschläge sind ausgeschaltet.')).toBeVisible();
    await expect(page.getByTestId('next-card')).toHaveCount(0);

    await ready(page, '/settings/darstellung');
    const timeToNext = section.getByRole('switch', { name: 'Zeit bis zum nächsten Termin' });
    await expect(timeToNext).toHaveAttribute('aria-checked', 'true');
    await timeToNext.click();
    await expect(timeToNext).toHaveAttribute('aria-checked', 'false');
    await ready(page, '/');
    await expect(
      page.getByText('Die Zeit bis zum nächsten Termin ist ausgeschaltet.'),
    ).toBeVisible();
  });

  test('quick capture knows the estimate: "Formular ausfüllen 15 min" lands as a ToDo with 15 min', async ({
    page,
  }) => {
    await ready(page, '/');
    await page.getByRole('button', { name: 'Schnell hinzufügen' }).click();
    const input = page.getByRole('textbox', { name: 'Was möchtest du festhalten?' });
    await input.fill('t Formular ausfüllen 15 min');
    await expect(page.getByTestId('capture-chips')).toContainText('etwa 15 Min');
    await input.press('Enter');
    await expect(page.getByText('Gespeichert in ToDos')).toBeVisible();
    await ready(page, '/');
    await expect(page.getByTestId('next-card')).toContainText('etwa 15 Min');
  });

  test('has no accessibility violations on the focus screen', async ({ page }) => {
    await addTodo(page, 'Barrierefrei prüfen');
    await ready(page, '/');
    await page
      .getByTestId('next-card')
      .getByRole('button', { name: /Anfangen/ })
      .click();
    await expect(page.getByRole('timer')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
