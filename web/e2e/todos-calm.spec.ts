import { expect, test, type Page } from '@playwright/test';
import { openTodosMenu, pickTodosList, ready } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function addTodo(page: Page, title: string, due?: string) {
  await ready(page, '/todos');
  await page.getByLabel('ToDo hinzufügen').fill(title);
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  if (due) {
    await page.getByRole('button', { name: new RegExp(title) }).click();
    await page.getByLabel('Fällig am').fill(due);
    await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
}

test.describe('Calm ToDo page (focus audit 2, package 2b)', () => {
  test('on top there is the add field and one "⋯" menu; the rest lives in the menu', async ({
    page,
  }) => {
    await addTodo(page, 'Wäsche falten');
    const main = page.locator('main');
    await expect(main.getByLabel('ToDo hinzufügen')).toBeVisible();
    await expect(main.getByRole('button', { name: 'Weitere Optionen' })).toBeVisible();
    // No separate list chips, no "Neue Liste" button, no "Erweitert" switch on the page itself.
    await expect(main.getByRole('button', { name: 'Neue Liste' })).toHaveCount(0);
    await expect(main.getByRole('switch', { name: 'Erweitert' })).toHaveCount(0);
    await expect(main.getByRole('navigation', { name: 'Liste' })).toHaveCount(0);

    const menu = await openTodosMenu(page);
    await expect(menu.getByRole('menuitemcheckbox', { name: 'Alle offenen' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(menu.getByRole('menuitem', { name: 'Neue Liste' })).toBeVisible();
    await expect(menu.getByRole('menuitemcheckbox', { name: 'Erweitert' })).toBeVisible();
    await expect(menu.getByRole('menuitemcheckbox', { name: 'Irgendwann' })).toBeVisible();
  });

  test('the list filter is a menu choice, named on the page, and one tap takes it back', async ({
    page,
  }) => {
    await addTodo(page, 'Wäsche falten');
    await pickTodosList(page, 'Irgendwann');
    await expect(page.getByTestId('todos-filter')).toContainText('Liste: Irgendwann');
    await page.getByTestId('todos-filter').getByRole('button', { name: 'Alle offenen' }).click();
    await expect(page.getByTestId('todos-filter')).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'Wäsche falten' })).toBeVisible();
  });

  test('no round "+" button on this page; other pages keep it on the phone', async ({
    page,
  }, info) => {
    // The round button (a phone control; the top bar has its own "+ Neu" with the same name).
    const fab = page.locator('[class*="_fab_"]');
    await ready(page, '/todos');
    await expect(fab).toHaveCount(0);
    await ready(page, '/');
    await expect(fab).toHaveCount(1);
    if (info.project.name === 'pixel-7') await expect(fab).toBeVisible();
  });

  test('"Wartet noch" appears once, as a group; each row can move to today right there', async ({
    page,
  }) => {
    await addTodo(page, 'Alte Sache', '2026-09-01');
    await expect(page.locator('[data-group="overdue"]')).toHaveCount(1);
    await expect(page.getByTestId('todos-waiting')).toHaveCount(1);
    // The old separate card with its own count is gone.
    await expect(page.getByText('wartet noch.', { exact: false })).toHaveCount(0);

    await page.locator('[data-group="overdue"]').getByRole('button', { name: 'Auf heute' }).click();
    await expect(page.locator('[data-group="overdue"]')).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'Alte Sache' })).toBeVisible();
    // Undo is one tap away.
    await page.getByRole('status').getByRole('button', { name: 'Rückgängig' }).click();
    await expect(page.locator('[data-group="overdue"]')).toHaveCount(1);
  });

  test('touch targets on the page head, the add field and the waiting rows are at least 44 px', async ({
    page,
  }) => {
    await addTodo(page, 'Alte Sache', '2026-09-01');
    const small = await page
      .locator('main')
      .locator('button, a[href]')
      .evaluateAll((els) =>
        els
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(
            ({ el, r }) =>
              r.width > 0 &&
              // Icon and row buttons look smaller and keep a 44 px hit area (ui/Button.module.css).
              !el.matches('[class*="_icon_"], [class*="_sm_"], [data-row]') &&
              (r.height < 44 || r.width < 44),
          )
          .map(
            ({ el, r }) =>
              `${el.textContent || el.getAttribute('aria-label')} ${r.width}x${r.height}`,
          ),
      );
    expect(small).toEqual([]);
  });

  test('"Später" is in every open row menu: out of today in one step, with undo', async ({
    page,
  }) => {
    await addTodo(page, 'Wäsche falten');
    // Adding is answered with one line and an undo.
    await expect(page.getByRole('status').filter({ hasText: 'ToDo hinzugefügt.' })).toBeVisible();
    await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
    await page.getByRole('menuitem', { name: 'Später', exact: true }).click();
    await expect(page.getByText('Auf morgen verschoben.')).toBeVisible();
    // Planned for tomorrow, so it is in "Später"... and not suggested for today.
    await ready(page, '/');
    await expect(page.getByTestId('widget-todos:next')).not.toContainText('Wäsche falten');
  });

  test('"Später" on a task that is due today also moves the date; undo brings it back', async ({
    page,
  }) => {
    await addTodo(page, 'Steuer vorbereiten', '2026-09-29');
    await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
    await page.getByRole('menuitem', { name: 'Später', exact: true }).click();
    await expect(page.getByText('Auf morgen verschoben.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Steuer vorbereiten/ })).toContainText('Morgen');
    await page.getByRole('status').getByRole('button', { name: 'Rückgängig' }).click();
    await expect(page.getByRole('button', { name: /Steuer vorbereiten/ })).toContainText('Heute');
  });
});
