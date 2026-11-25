import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { dismissNotices } from '../helpers';
import { test } from './helpers';
import { DESKTOP, PHONE } from './guards';

/**
 * A thing with steps and „Los“ (planner hub 2, package 5a; hand-off 05): a ToDo with a three-line checklist on today's
 * sheet. Its row says „3 Schritte“; expanded, the steps are tick lines and the foot has „Los“. „Los“ shows only the next
 * step; „Fertig · weiter“ ticks it; a reload keeps the place; „Fertig“ on the last one ticks the ToDo and returns to the
 * plan – checked in IndexedDB. Invented rows only.
 */
const TODAY = '2026-11-30'; // Monday
const base = { createdAt: 1, updatedAt: 1, deviceId: 'e2e', deletedAt: null, _f: {} };
const STEPS = ['Wäsche anstellen', 'Bad wischen', 'Müll rausbringen'];

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
    _modules: ['todos', 'planner'].map((id) => ({ id, enabled: true, dataPolicy: null })),
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
        checklist: STEPS.map((text, i) => ({ id: `c${i}`, text, done: false })),
      },
    ],
    planner_assignment: [laid('todos:hh', 0)],
  });
  await page.goto('/planner');
  await expect(page.locator('main h1')).toBeVisible();
}

const rowOf = (page: Page) => page.locator('[data-row-key="todos:hh"]').first();
const ticked = async (page: Page) => {
  const [task] = await rows<{ done: boolean; checklist: { done: boolean }[] }>(page, 'todos_task');
  return { done: task?.done, steps: task?.checklist.map((c) => c.done) };
};

for (const [name, viewport, mobile] of [
  ['desktop', DESKTOP, false],
  ['phone', PHONE, true],
] as const) {
  test.describe(`plan steps (5a), ${name}`, () => {
    test.use({ viewport, isMobile: mobile, hasTouch: mobile });
    test.setTimeout(120_000);

    test('the row, its steps, „Los“ – one step at a time, a reload keeps the place, „Fertig“ ticks the ToDo', async ({
      page,
    }) => {
      await prepare(page);
      const row = rowOf(page);
      await expect(row).toContainText('3 Schritte');
      await row.locator('button[data-row]').first().click();
      const box = row.getByTestId('row-compartment');
      await expect(box.getByRole('checkbox', { name: '„Bad wischen“ abhaken' })).toBeVisible();
      await box.getByRole('button', { name: 'Los', exact: true }).click();
      await expect(page.getByRole('heading', { level: 1, name: STEPS[0] })).toBeVisible();
      await expect(page.getByText('Haushalt · Schritt 1 von 3')).toBeVisible();
      // Only the next one: the other steps are nowhere on the stage.
      await expect(page.getByText(STEPS[1], { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Fertig · weiter' }).click();
      await expect(page.getByRole('heading', { level: 1, name: STEPS[1] })).toBeVisible();
      await expect.poll(async () => (await ticked(page)).steps).toEqual([true, false, false]);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: STEPS[1] })).toBeVisible();
      await page.getByRole('button', { name: 'Fertig · weiter' }).click();
      await expect(page.getByRole('heading', { level: 1, name: STEPS[2] })).toBeVisible();
      await page.getByRole('button', { name: 'Fertig', exact: true }).click();
      await expect(page).toHaveURL(/\/planner$/);
      await expect.poll(() => ticked(page)).toEqual({ done: true, steps: [true, true, true] });
    });
  });
}

// The stage in an axe pass (A11Y „every package … adds its state“), light and dark.
for (const scheme of ['light', 'dark'] as const)
  test(`plan steps (5a): the „Los“ stage passes axe (${scheme})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await prepare(page);
    await rowOf(page).locator('button[data-row]').first().click();
    const results0 = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results0.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
    await rowOf(page)
      .getByTestId('row-compartment')
      .getByRole('button', { name: 'Los', exact: true })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: STEPS[0] })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
  });
