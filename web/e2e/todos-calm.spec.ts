import { expect, test, type Page } from '@playwright/test';
import { openTodosMenu, pickTodosList, ready } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function addTodo(page: Page, title: string, due?: string) {
  await ready(page, '/todos');
  await page.locator('[data-page-action]:visible, [data-testid="bottom-plus"]:visible').click();
  await page.getByRole('dialog').getByLabel('Titel').fill(title);
  await page.getByRole('dialog').getByRole('button', { name: 'Hinzufügen', exact: true }).click();
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
    // Identity 4.0: no add field on the page; the head's action (the plus on the phone) is the one entry.
    await expect(main.getByRole('textbox')).toHaveCount(0);
    await expect(main.getByRole('button', { name: 'Weitere Optionen' })).toBeVisible();
    // No separate list chips, no "Neue Liste" button, no "Erweitert" switch on the page itself.
    await expect(main.getByRole('button', { name: 'Neue Liste' })).toHaveCount(0);
    await expect(main.getByRole('switch', { name: 'Mehr Felder anzeigen' })).toHaveCount(0);
    await expect(main.getByRole('navigation', { name: 'Liste' })).toHaveCount(0);

    const menu = await openTodosMenu(page);
    await expect(menu.getByRole('menuitemcheckbox', { name: 'Alle offenen' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(menu.getByRole('menuitem', { name: 'Neue Liste' })).toBeVisible();
    await expect(
      menu.getByRole('menuitemcheckbox', { name: 'Mehr Felder anzeigen' }),
    ).toBeVisible();
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

  test('no round "+" button anywhere; on the phone the plus of the bottom bar adds a ToDo here and captures on the overview', async ({
    page,
  }, info) => {
    // The round button is gone with Identity 4.0 (its class name was the hook of this test).
    const fab = page.locator('[class*="_fab_"]');
    const plus = page.getByTestId('bottom-plus');
    await ready(page, '/todos');
    await expect(fab).toHaveCount(0);
    await expect(plus).toHaveCount(1);
    // Identity 4.0: the page declares its one action, the plus carries it.
    await expect(plus).toHaveAttribute('data-plus', 'page');
    await expect(plus).toHaveAttribute('aria-label', 'Aufgabe eintragen');
    await ready(page, '/');
    await expect(fab).toHaveCount(0);
    await expect(plus).toHaveAttribute('data-plus', 'capture');
    await expect(plus).toHaveAttribute('aria-label', 'Neu eintragen');
    if (info.project.name === 'pixel-7') {
      await expect(plus).toBeVisible();
      await ready(page, '/todos');
      await plus.click();
      // The page's own entry: its add dialog opens with the cursor in the title, not the capture sheet.
      await expect(
        page.getByRole('dialog', { name: 'ToDo hinzufügen' }).getByLabel('Titel'),
      ).toBeFocused();
      await expect(page.getByRole('dialog', { name: 'Schnell hinzufügen' })).toHaveCount(0);
    }
  });

  test('"Wartet noch" appears once, as a group; each row can move to today right there', async ({
    page,
  }, info) => {
    await addTodo(page, 'Alte Sache', '2026-09-01');
    await expect(page.locator('[data-group="overdue"]')).toHaveCount(1);
    await expect(page.getByTestId('todos-waiting')).toHaveCount(1);
    // The old separate card with its own count is gone.
    await expect(page.getByText('wartet noch.', { exact: false })).toHaveCount(0);

    const waiting = page.locator('[data-group="overdue"]');
    // On the phone the row's button gives way to the title (UI round 6, U21); the row menu has it.
    if (info.project.name === 'pixel-7') {
      await waiting.getByRole('button', { name: 'Weitere Aktionen' }).click();
      await page.getByRole('menuitem', { name: 'Auf heute', exact: true }).click();
    } else await waiting.getByRole('button', { name: 'Auf heute' }).click();
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
    await expect(page.getByRole('button', { name: /^Steuer vorbereiten/ })).toContainText('Morgen');
    await page.getByRole('status').getByRole('button', { name: 'Rückgängig' }).click();
    await expect(page.getByRole('button', { name: /^Steuer vorbereiten/ })).toContainText('Heute');
  });
});
