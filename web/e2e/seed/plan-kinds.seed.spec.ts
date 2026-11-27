import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { dismissNotices } from '../helpers';
import { test } from './helpers';
import { DESKTOP, PHONE } from './guards';

/**
 * Kinds in the field (planner hub 2, package 3; hand-off 03): a sure line shows K1 under the field (on the phone's last
 * row above it) in the examples' place; Enter stores that kind with one toast K4 and „Rückgängig“; K3 makes it a plain
 * ToDo; „Wäsche morgen“ shows nothing. The pantry knows „Milch“. Axe on the line, light and dark. Invented rows only.
 */
const TODAY = '2026-11-30'; // Monday
const base = { updatedAt: 1, deviceId: 'e2e', deletedAt: null, _f: {} };
const MODULES = [
  'todos',
  'planner',
  'invoices',
  'lists',
  'pantry',
  'calendar',
  'notes',
  'bookmarks',
];

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
            for (const r of rows) tx.objectStore(store).put({ createdAt: 1, ...base, ...r });
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

async function count(page: Page, store: string): Promise<number> {
  return page.evaluate(
    (store) =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction(store).objectStore(store).getAll();
          req.onsuccess = () => {
            db.close();
            resolve(
              (req.result as { deletedAt: unknown }[]).filter((r) => r.deletedAt === null).length,
            );
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
    _modules: MODULES.map((id) => ({ id, enabled: true, dataPolicy: null })),
    todos_list: [{ id: 'inbox', name: 'Eingang', order: 0 }],
    lists_list: [{ id: 'shopping-default', name: 'Einkauf', kind: 'shopping', order: 0 }],
    pantry_item: [{ id: 'p1', name: 'Milch', place: 'fridge', count: 1 }],
  });
  await page.goto('/planner');
  await expect(page.locator('main h1')).toBeVisible();
}

const field = (page: Page) => page.getByRole('textbox', { name: 'Eintragen oder sagen' });

for (const [name, viewport, mobile] of [
  ['desktop', DESKTOP, false],
  ['phone', PHONE, true],
] as const) {
  test.describe(`kinds in the field (3), ${name}`, () => {
    test.use({ viewport, isMobile: mobile, hasTouch: mobile });
    test.setTimeout(120_000);
    test('a sure line says what it becomes; Enter stores it with one undo; K3 makes it a task', async ({
      page,
    }) => {
      await prepare(page);
      const input = field(page);
      // A date word without a sure kind: no line.
      await input.fill('Wäsche morgen');
      await expect(page.getByTestId('planner-kind')).toHaveCount(0);
      await input.fill('Rechnung Stadtwerke 80 € bis Fr');
      const line = page.getByTestId('planner-kind');
      await expect(line).toContainText('Wird:');
      await expect(line).toContainText('Rechnung');
      await expect(line).toContainText('Stadtwerke');
      await expect(line).toContainText(/Frist Fr\.? 4\. Dez/);
      // The phone's last row: the line stands above the field, never under the keyboard.
      const lineBox = (await line.boundingBox())!;
      const inputBox = (await input.boundingBox())!;
      if (mobile) expect(lineBox.y).toBeLessThan(inputBox.y);
      else expect(lineBox.y).toBeGreaterThan(inputBox.y);
      await input.press('Enter');
      await expect(input).toHaveValue('');
      const toast = page.getByText('Rechnung angelegt, liegt unter „Noch ohne Tag“.');
      await expect(toast).toBeVisible();
      await expect.poll(() => count(page, 'invoices_invoice')).toBe(1);
      await expect.poll(() => count(page, 'todos_task')).toBe(0);
      // One „Rückgängig“ takes the invoice and its plan row back.
      await page.getByRole('button', { name: 'Rückgängig' }).last().click();
      await expect.poll(() => count(page, 'invoices_invoice')).toBe(0);
      await expect.poll(() => count(page, 'planner_item')).toBe(0);

      // A name the pantry knows: the shopping list; K3 makes it a plain ToDo instead.
      await input.fill('Milch');
      await expect(line).toContainText('Einkaufsliste');
      await page.getByRole('button', { name: 'Als Aufgabe eintragen' }).click();
      await expect.poll(() => count(page, 'todos_task')).toBe(1);
      await expect.poll(() => count(page, 'lists_item')).toBe(0);
      await expect(
        page.getByRole('checkbox', { name: 'Erledigt: Milch', exact: true }).first(),
      ).toBeVisible();
    });
  });
}

for (const scheme of ['light', 'dark'] as const)
  test(`kinds in the field (3): the line passes axe (${scheme})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await prepare(page);
    await field(page).fill('Haushalt: Wäsche, Bad, Küche');
    await expect(page.getByTestId('planner-kind')).toContainText('Aufgabe mit Schritten');
    const violations = (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`);
    expect(violations).toEqual([]);
  });

test('a list by its name (V1): „Liste in den Plan“, Enter puts its row under „Noch ohne Tag“, no entry added', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize(DESKTOP);
  await prepare(page);
  await put(page, {
    lists_list: [{ id: 'drog', name: 'Drogerie', kind: 'shopping', order: 1 }],
    lists_item: [
      { id: 'd1', listId: 'drog', name: 'Zahnpasta', done: false, order: 0 },
      { id: 'd2', listId: 'drog', name: 'Duschgel', done: false, order: 1 },
    ],
  });
  await page.reload();
  await field(page).fill('Drogerie');
  await expect(page.getByTestId('planner-kind')).toContainText('Liste in den Plan');
  await expect(page.getByTestId('planner-kind')).toContainText('Drogerie');
  await field(page).press('Enter');
  await expect(page.getByText('Liste steht im Plan, unter „Noch ohne Tag“.')).toBeVisible();
  await page.getByRole('button', { name: 'Noch ohne Tag ausklappen' }).click();
  await expect(page.getByRole('button', { name: /^Einkaufen · 2 Dinge/ }).first()).toBeVisible();
  expect(await count(page, 'lists_item')).toBe(2);
  expect(await count(page, 'todos_task')).toBe(0);
});
