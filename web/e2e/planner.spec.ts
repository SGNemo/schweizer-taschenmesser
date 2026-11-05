import { expect, test, type Page } from '@playwright/test';
import { ready, showPreview } from './helpers';

/** Deterministic "today": Monday 2026-11-09, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-09T10:00:00'));
  await showPreview(page);
});

/** Enables the planner (preview) and the ToDos with a raw write into the module table, like the library would. */
async function enablePlanner(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    (ids) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          for (const id of ids)
            tx.objectStore('_modules').put({
              id,
              enabled: true,
              dataPolicy: null,
              createdAt: 1,
              updatedAt: 1,
              deviceId: 'e2e',
              deletedAt: null,
              _f: {},
            });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    ['todos', 'planner'],
  );
}

/** A ToDo through the planner's own field; the run follows and the row appears on the board. */
async function enter(page: Page, text: string) {
  const field = page.getByLabel('Eintragen', { exact: true });
  await expect(field).toBeVisible();
  await field.focus();
  await page.keyboard.insertText(text);
  await expect(field).toHaveValue(text);
  await page.keyboard.press('Enter');
  await expect(field).toHaveValue('');
}

const today = (page: Page) => page.getByTestId('day-2026-11-09');

test.describe('Planer (week board, package 1)', () => {
  test('the one field makes a ToDo; „bis Do“ sets a deadline; the head counts the free time', async ({
    page,
  }) => {
    await enablePlanner(page);
    await ready(page, '/planner');
    await expect(page.getByTestId('planner-head')).toContainText('frei heute');
    await enter(page, 'Steuer 2 Std bis Do');
    await expect(page.getByText('Eingetragen · Frist Do', { exact: false })).toBeVisible();
    // 120 minutes become two sessions of one hour on different days.
    await expect(page.getByText('Steuer · Teil 1/2')).toBeVisible();
    await expect(page.getByText('Steuer · Teil 2/2')).toBeVisible();
    await expect(today(page)).toContainText('Frist Do');
    await expect(page.getByTestId('planner-head')).toContainText('2 h 12 frei heute');
    // The reason sits behind „Warum hier?“.
    await today(page).getByRole('button', { name: 'Warum hier?' }).first().click();
    await expect(today(page)).toContainText('muss bis Do fertig sein');
  });

  test('day sheet: less time, „Tag frei“ empties the day, both undoable', async ({ page }) => {
    await enablePlanner(page);
    await ready(page, '/planner');
    await enter(page, 'Blogpost 90min');
    await expect(today(page)).toContainText('Blogpost');
    await today(page)
      .getByRole('button', { name: /^Mo\.? 9\./ })
      .click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByTestId('day-available')).toHaveText('4 h');
    await sheet.getByRole('button', { name: 'Weniger Zeit' }).click();
    await expect(sheet.getByTestId('day-available')).toHaveText('3 h 30');
    await sheet.getByTestId('day-off').click();
    await expect(sheet.getByTestId('day-available')).toHaveText('frei');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('planner-head')).toContainText('Heute ist frei.');
    await expect(page.getByTestId('day-2026-11-10')).toContainText('Blogpost');
    await page.getByRole('button', { name: 'Rückgängig' }).last().click();
    await expect(page.getByTestId('planner-head')).not.toContainText('Heute ist frei.');
  });

  test('Erledigt and Rückgängig, Festnageln, Später; the ToDo page shows „im Plan“', async ({
    page,
  }) => {
    await enablePlanner(page);
    await ready(page, '/planner');
    await enter(page, 'Keller 60min');
    await enter(page, 'Angebot 45min !hoch');
    await expect(today(page)).toContainText('Angebot');
    // Erledigt from the ⋯ menu, one tap, with undo.
    await today(page).getByRole('button', { name: 'Aktionen für Keller' }).click();
    await page.getByRole('menuitem', { name: 'Erledigt' }).click();
    await expect(today(page)).not.toContainText('Keller');
    await page.getByRole('button', { name: 'Rückgängig' }).last().click();
    await expect(today(page)).toContainText('Keller');
    // Festnageln keeps the thing on its day: the menu changes to „Nicht mehr festnageln“.
    await today(page).getByRole('button', { name: 'Aktionen für Keller' }).click();
    await page.getByRole('menuitem', { name: 'Festnageln auf Mo' }).click();
    await expect(page.getByText('Festgenagelt: Mo')).toBeVisible();
    await today(page).getByRole('button', { name: 'Aktionen für Keller' }).click();
    await expect(page.getByRole('menuitem', { name: 'Nicht mehr festnageln' })).toBeVisible();
    await page.keyboard.press('Escape');
    // Später: the thing's own date becomes tomorrow; in Bald the ToDo page says where the planner put it.
    await today(page).getByRole('button', { name: 'Aktionen für Angebot' }).click();
    await page.getByRole('menuitem', { name: 'Später' }).click();
    await expect(page.getByTestId('day-2026-11-10')).toContainText('Angebot');
    await ready(page, '/todos?view=soon');
    await expect(page.getByTestId('in-plan').first()).toHaveText('im Plan: Di');
    await expect(page.getByRole('button', { name: 'Neu planen' })).toHaveCount(0);
  });

  test('phone: one day per screen with a strip from today and no horizontal overflow at 412 px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await enablePlanner(page);
    await ready(page, '/planner');
    await enter(page, 'Fenster putzen 30min');
    const strip = page.getByRole('group', { name: 'Tage' });
    await expect(strip).toBeVisible();
    await expect(strip.getByRole('button')).toHaveCount(7);
    await expect(today(page)).toContainText('Fenster putzen');
    await strip.getByRole('button').nth(1).click();
    await expect(page.getByTestId('day-2026-11-10')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('„Woche prüfen“ from the head menu confirms the week in two taps', async ({ page }) => {
    await enablePlanner(page);
    await ready(page, '/planner');
    await page.getByRole('button', { name: 'Weitere Optionen' }).click();
    await page.getByRole('menuitem', { name: 'Woche prüfen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Woche prüfen' });
    await dialog.getByRole('button', { name: 'Mehr Zeit' }).first().click();
    await dialog.getByRole('button', { name: 'Passt so' }).click();
    await expect(page.getByText('Woche bestätigt.')).toBeVisible();
    await expect(page.getByTestId('planner-head')).toContainText('3 h 36 frei heute');
  });
});
