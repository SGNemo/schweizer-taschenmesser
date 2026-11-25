import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { dismissNotices } from '../helpers';
import { test } from './helpers';
import { DESKTOP, PHONE } from './guards';

/**
 * The row opens instead of jumping (planner hub 2, package 4a, hand-off 04): on today's sheet a shopping list and a
 * ToDo with a checklist; two list entries and one checklist line are ticked in their compartments – without leaving
 * `/planner`. Each tick is the module's own write (the rows in IndexedDB say so). Then: one compartment at a time, Esc
 * closes and gives the focus back to the title, „Ganz öffnen“ is the old jump. Invented rows only.
 */
const TODAY = '2026-11-30'; // Monday
const base = { createdAt: 1, updatedAt: 1, deviceId: 'e2e', deletedAt: null, _f: {} };

const laid = (itemKey: string, order: number) => ({
  id: `${itemKey}#0`,
  itemKey,
  k: 0,
  of: 1,
  date: TODAY,
  minutes: 20,
  order,
  reason: 'new',
});

async function put(page: Page, rowsByStore: Record<string, Record<string, unknown>[]>) {
  await page.evaluate(
    ({ rowsByStore, base }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(Object.keys(rowsByStore), 'readwrite');
          for (const [store, rows] of Object.entries(rowsByStore))
            for (const r of rows) tx.objectStore(store).put({ ...base, ...r });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { rowsByStore, base },
  );
}

async function rows<T>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(
    (store) =>
      new Promise<T[]>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction(store).objectStore(store).getAll();
          req.onsuccess = () => {
            db.close();
            resolve(req.result as T[]);
          };
          req.onerror = () => reject(req.error);
        };
      }),
    store,
  );
}

async function prepare(page: Page) {
  await page.clock.setFixedTime(new Date(`${TODAY}T09:00:00`));
  await dismissNotices(page);
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await put(page, {
    _modules: ['todos', 'planner', 'lists'].map((id) => ({ id, enabled: true, dataPolicy: null })),
    todos_list: [{ id: 'inbox', name: 'Eingang', order: 0 }],
    todos_task: [
      {
        id: 'hh',
        listId: 'inbox',
        title: 'Haushalt',
        done: false,
        priority: 0,
        order: 0,
        estimateMin: 30,
        note: 'Vor dem Besuch am Abend.',
        checklist: [
          { id: 'c1', text: 'Wäsche anstellen', done: false },
          { id: 'c2', text: 'Bad wischen', done: false },
        ],
      },
    ],
    lists_list: [{ id: 'shopping-default', name: 'Einkauf', kind: 'shopping', order: 0 }],
    lists_item: ['Milch', 'Spülmittel', 'Batterien AA'].map((name, i) => ({
      id: `s${i}`,
      listId: 'shopping-default',
      name,
      done: false,
      order: i,
    })),
    planner_item: [
      {
        id: 'lists:shopping-default',
        source: { module: 'lists', id: 'shopping-default' },
        order: 0,
      },
    ],
    planner_assignment: [laid('lists:shopping-default', 0), laid('todos:hh', 1)],
  });
  await page.goto('/planner');
  await expect(page.locator('main h1')).toBeVisible();
}

const rowOf = (page: Page, key: string) => page.locator(`[data-row-key="${key}"]`).first();

for (const [name, viewport, mobile] of [
  ['desktop', DESKTOP, false],
  ['phone', PHONE, true],
] as const) {
  test.describe(`plan row expand (4a), ${name}`, () => {
    test.use({ viewport, isMobile: mobile, hasTouch: mobile });
    test.setTimeout(120_000);

    test('two list entries and a checklist line ticked in the planner, which is never left', async ({
      page,
    }) => {
      await prepare(page);
      const list = rowOf(page, 'lists:shopping-default');
      const title = list.getByRole('button', { name: /\. Aufklappen$/ });
      await expect(title).toHaveAttribute('aria-expanded', 'false');
      // No chevron on a closed row.
      await expect(list.locator('[data-row-chevron]')).toHaveCount(0);
      await title.click();
      const box = list.getByRole('group', { name: /Einkauf/ }).last();
      await expect(box).toBeVisible();
      await expect(list.getByRole('button', { name: /\. Zuklappen$/ })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await expect(list.locator('[data-row-chevron]')).toHaveCount(1);
      for (const item of ['Milch', 'Spülmittel']) {
        const tick = box.getByRole('checkbox', { name: `„${item}“ abhaken` });
        await tick.click();
        await expect(tick).toBeChecked();
      }
      await expect
        .poll(async () =>
          (await rows<{ name: string; done: boolean }>(page, 'lists_item'))
            .filter((i) => i.done)
            .map((i) => i.name)
            .sort(),
        )
        .toEqual(['Milch', 'Spülmittel']);
      // Bought entries on the list, one still open: Listen's own „Gekauftes entfernen“ clears them, still in the
      // planner (X8 „Fertig eingekauft“ once nothing is open).
      await box.getByRole('button', { name: 'Gekauftes entfernen (2)' }).click();
      await expect
        .poll(async () =>
          (await rows<{ name: string; deletedAt: number | null }>(page, 'lists_item'))
            .filter((i) => i.deletedAt === null)
            .map((i) => i.name),
        )
        .toEqual(['Batterien AA']);

      // Another row opens: the first one closes (one at a time).
      const todo = rowOf(page, 'todos:hh');
      await todo.getByRole('button', { name: /^Haushalt.*\. Aufklappen$/ }).click();
      await expect(page.getByTestId('row-compartment')).toHaveCount(1);
      const panel = todo.getByTestId('row-compartment');
      await expect(panel).toContainText('Vor dem Besuch am Abend.');
      const step = panel.getByRole('checkbox', { name: '„Bad wischen“ abhaken' });
      await step.click();
      await expect(step).toBeChecked();
      await expect
        .poll(async () => {
          const [task] = await rows<{
            checklist: { text: string; done: boolean }[];
            done: boolean;
          }>(page, 'todos_task');
          return task?.checklist.filter((c) => c.done).map((c) => c.text);
        })
        .toEqual(['Bad wischen']);
      // The ToDo itself stays open: „Erledigt“ is the row's own tick.
      expect((await rows<{ done: boolean }>(page, 'todos_task'))[0]?.done).toBe(false);
      await expect(page).toHaveURL(/\/planner/);

      // Esc closes and gives the focus back to the title.
      await panel.getByRole('checkbox', { name: '„Wäsche anstellen“ abhaken' }).focus();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('row-compartment')).toHaveCount(0);
      await expect(todo.getByRole('button', { name: /^Haushalt.*\. Aufklappen$/ })).toBeFocused();

      // „Ganz öffnen“ is the old jump.
      await page.keyboard.press('Enter');
      await todo
        .getByTestId('row-compartment')
        .getByRole('button', { name: 'Ganz öffnen' })
        .click();
      await expect(page).toHaveURL(/\/todos/);
    });
  });
}

// The open compartment in the planner's axe pass (A11Y „every package … adds its state“), light and dark.
for (const scheme of ['light', 'dark'] as const)
  test(`plan row expand (4a): an open compartment passes axe (${scheme})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await prepare(page);
    await rowOf(page, 'todos:hh')
      .getByRole('button', { name: /^Haushalt.*\. Aufklappen$/ })
      .click();
    await expect(page.getByRole('checkbox', { name: '„Bad wischen“ abhaken' })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
  });
