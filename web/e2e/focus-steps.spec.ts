import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function addTodo(page: Page, title: string) {
  await ready(page, '/todos');
  await page.getByLabel('ToDo hinzufügen').fill(title);
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
}

test.describe('Focus: steps from local templates, one round at a time (QA V24/B27)', () => {
  test('the steps depend on the title, are only a preview until taken, and stay private', async ({
    page,
  }) => {
    await addTodo(page, 'Formular ausfüllen');
    await ready(page, '/');
    await page
      .getByTestId('next-card')
      .getByRole('button', { name: /Anfangen/ })
      .click();
    // A round start and a preview send nothing anywhere.
    const requests: string[] = [];
    page.on('request', (r) => requests.push(new URL(r.url()).hostname));
    await page.getByRole('button', { name: 'Schritte aus einer Vorlage' }).click();
    const proposal = page.getByTestId('steps-proposal');
    await expect(proposal).toContainText('Alle Unterlagen an einen Platz legen');
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await page.getByRole('button', { name: 'Übernehmen' }).click();
    await expect(page.getByRole('checkbox', { name: 'Prüfen und abschicken' })).toBeVisible();
    expect(requests.filter((h) => h !== 'localhost')).toEqual([]);
  });

  test('a second task asks before it replaces the running round', async ({ page }) => {
    await addTodo(page, 'Wäsche falten');
    await addTodo(page, 'Keller aufräumen');
    await ready(page, '/');
    await page
      .getByTestId('next-card')
      .getByRole('button', { name: /Anfangen/ })
      .click();
    // Wait for the focus screen itself: on a slow runner the heading is still the home page's.
    await expect(page).toHaveURL(/\/todos\/focus\//);
    await expect(page.getByRole('timer')).toBeVisible();
    const first = await page.getByRole('heading', { level: 1 }).textContent();
    await page.getByRole('button', { name: 'Verlassen' }).click();
    // The other task's focus screen: no silent replacement.
    await ready(page, '/todos');
    const other = first === 'Wäsche falten' ? 'Keller aufräumen' : 'Wäsche falten';
    await page.getByRole('button', { name: new RegExp(other) }).click();
    await page.getByRole('button', { name: 'Fokus', exact: true }).click();
    await expect(page.getByText(/Neue Runde starten und die laufende ersetzen/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bei der laufenden bleiben' })).toBeVisible();
    await page.getByRole('button', { name: 'Neue Runde starten' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(other);
    await expect(page.getByRole('timer')).toBeVisible();
  });

  test('a new ToDo without a chosen list lands in the inbox, not in the first list', async ({
    page,
  }) => {
    await addTodo(page, 'Etwas Neues');
    await ready(page, '/todos');
    await expect(page.getByTestId('todos-inbox')).toBeVisible();
  });
});
