import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ready, showPreview } from './helpers';

/**
 * ToDos see what is in the plan (todos-plan-state): 20 things imported, 5 laid in the planner → the ToDo page says
 * „Noch nicht im Plan · 15“; three picked → „In den Plan …“ → Morgen → 12; one undo → 15. Desktop and Pixel 7
 * (412 px). Deterministic "today": Tuesday 2026-09-29, 10:00.
 */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
  await showPreview(page);
});

const NAMES = Array.from({ length: 20 }, (_, i) => `Ding ${String(i + 1).padStart(2, '0')}`);
const CSV = [
  'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE',
  ...NAMES.map((n) => `task,${n},,1,1,,,,,`),
].join('\n');

async function modulesOn(page: Page) {
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

async function importTwenty(page: Page) {
  await ready(page, '/todos');
  await page.getByRole('button', { name: 'Weitere Optionen', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Importieren' }).click();
  const dialog = page.getByRole('dialog', { name: /Importieren/ });
  await dialog
    .getByRole('button', { name: /Aus Todoist, TickTick, Google Tasks oder Microsoft To Do/ })
    .click();
  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Datei wählen …' }).click();
  await (
    await chooser
  ).setFiles({ name: 'Alles.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV, 'utf8') });
  await dialog.getByRole('button', { name: '20 Einträge importieren' }).click();
  await expect(dialog.getByRole('status')).toHaveText('20 Einträge wurden importiert.');
  await dialog.getByRole('button', { name: 'Schließen' }).last().click();
}

/** Five things laid in the planner: „Noch ohne Tag“ → ⋯ → „Verschieben …“ → Mi 30. */
async function layFiveInPlanner(page: Page) {
  await ready(page, '/planner');
  const waiting = page.locator('[data-group="wait"]');
  const toggle = waiting.locator('h2').getByRole('button');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  for (const name of NAMES.slice(0, 5)) {
    await waiting.getByRole('button', { name: `Aktionen für ${name}` }).click();
    await page.getByRole('menuitem', { name: 'Verschieben …' }).click();
    await page
      .getByRole('dialog', { name: `Verschieben: ${name}` })
      .getByRole('button', { name: 'Mi 30.', exact: true })
      .click();
    await expect(page.getByRole('status').last()).toContainText('Liegt auf Mi');
    await expect(waiting.getByRole('button', { name: `Aktionen für ${name}` })).toHaveCount(0);
  }
  // The planner's write-back to the ToDos follows its run: wait for it before the next page load cuts it off.
  await expect.poll(() => markedTasks(page)).toBe(5);
}

/** How many ToDos carry the planner's mark (straight from IndexedDB). */
const markedTasks = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction('todos_task').objectStore('todos_task').getAll();
          req.onsuccess = () => {
            db.close();
            resolve(
              (req.result as { plannedFor?: string; planMark?: { date: string } }[]).filter(
                (x) => x.planMark && x.planMark.date === x.plannedFor,
              ).length,
            );
          };
          req.onerror = () => reject(req.error);
        };
      }),
  );

const unplanned = (page: Page) => page.getByTestId('plan-filter-unplanned');
/** The marks on the list's rows (a wide page also shows the picked task's mark in its detail panel). */
const rowMarks = (page: Page) => page.locator('main li [data-testid="plan-mark"]');

test('20 imported, 5 laid in the planner → 15 not in the plan; three into the plan tomorrow → 12; undo → 15', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await modulesOn(page);
  await importTwenty(page);
  // Freshly imported: nothing is in the plan yet.
  await expect(unplanned(page)).toHaveText('Noch nicht im Plan · 20');
  await layFiveInPlanner(page);

  await ready(page, '/todos');
  await expect(unplanned(page)).toHaveText('Noch nicht im Plan · 15');
  // The shared mark (package 10b), read from the planner: only the five laid things carry one.
  await expect(rowMarks(page)).toHaveCount(5);
  await expect(rowMarks(page).first()).toHaveText('Im Plan · Mi');

  // Only what still needs a day.
  await unplanned(page).click();
  await expect(page.getByRole('checkbox', { name: 'Ding 01', exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Ding 06', exact: true })).toHaveCount(1);
  // Not in the plan: no mark (the entry is in ⋯).
  await expect(rowMarks(page)).toHaveCount(0);

  await page.getByTestId('todos-select').click();
  for (const name of ['Ding 06', 'Ding 07', 'Ding 08'])
    await page.getByRole('checkbox', { name: `„${name}“ auswählen` }).click();
  await page.getByTestId('todos-to-plan').click();
  const dialog = page.getByRole('dialog', { name: 'In den Plan: 3 Aufgaben' });
  await dialog.getByRole('button', { name: 'Morgen', exact: true }).click();
  await expect(page.getByRole('status').last()).toContainText('3 Dinge liegen auf Mi');
  await expect(unplanned(page)).toHaveText('Noch nicht im Plan · 12');
  // The filter still shows what needs a day: the three left it.
  await expect(page.getByRole('checkbox', { name: 'Ding 06', exact: true })).toHaveCount(0);

  await page.getByTestId('plan-filter-planned').click();
  await expect(rowMarks(page)).toHaveCount(8);

  // One undo takes the three back.
  await page.getByRole('button', { name: 'Rückgängig' }).last().click();
  await expect(unplanned(page)).toHaveText('Noch nicht im Plan · 15');
  await expect(rowMarks(page)).toHaveCount(5);

  // The jump: ⋯ → „Im Planer zeigen“ opens the planner on Wednesday with the row in view.
  await page
    .getByRole('listitem')
    .filter({ has: page.getByTestId('plan-mark') })
    .first()
    .getByRole('button', { name: 'Weitere Aktionen' })
    .first()
    .click();
  await page.getByRole('menuitem', { name: 'Im Planer zeigen' }).click();
  await expect(page).toHaveURL(/\/planner/);
  const row = page.locator('[data-row-key^="todos:"]', { hasText: 'Ding 0' }).first();
  await expect(row).toBeVisible();
  await expect(row.locator('[data-row]')).toBeFocused();

  // Accessibility of the filter and the marks.
  await ready(page, '/todos');
  await expect(unplanned(page)).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
