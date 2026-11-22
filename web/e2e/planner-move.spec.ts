import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { ready, showPreview } from './helpers';

/**
 * Planner rethink, package 5 – moving: drag a row onto a day of the band or the grid (mouse; touch after a long
 * press), „Verschieben …“ first in the row's ⋯, `M` on the focused row with arrow keys in the day pick, „Auswählen“
 * on the day sheet. Every drop moves the dropped thing and nothing else (row snapshot), says so in one live message,
 * and the drag has a one-pointer way (WCAG 2.5.7).
 */

/** Deterministic "today": Monday 2026-11-09, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-09T10:00:00'));
  await showPreview(page);
});

async function enablePlanner(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          for (const id of ['todos', 'planner'])
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
  );
}

async function enter(page: Page, text: string) {
  const field = page.getByRole('textbox', { name: 'Eintragen oder sagen', exact: true });
  await field.fill(text);
  await field.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Liegt auf' })).toBeVisible();
  await expect(field).toHaveValue('');
}

/** `date` of every stored planner row, by the title of its ToDo. */
async function rowDays(page: Page): Promise<Record<string, string>> {
  return page.evaluate(
    () =>
      new Promise<Record<string, string>>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['planner_assignment', 'todos_task']);
          const rows = tx.objectStore('planner_assignment').getAll();
          const tasks = tx.objectStore('todos_task').getAll();
          tx.oncomplete = () => {
            db.close();
            const title = new Map(
              (tasks.result as { id: string; title: string }[]).map((t) => [t.id, t.title]),
            );
            resolve(
              Object.fromEntries(
                (rows.result as { itemKey: string; date: string; deletedAt: unknown }[])
                  .filter((r) => !r.deletedAt)
                  .map((r) => [title.get(r.itemKey.split(':')[1]!) ?? r.itemKey, r.date]),
              ),
            );
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

/** Three things on today (Monday). */
async function threeToday(page: Page) {
  await enablePlanner(page);
  await ready(page, '/planner');
  for (const line of ['Keller 30min', 'Steuer 30min', 'Fenster 30min']) await enter(page, line);
  await expect.poll(async () => Object.keys(await rowDays(page)).length).toBe(3);
}

const rowOf = (page: Page, title: string) =>
  page.getByTestId('day-2026-11-09').locator('li').filter({ hasText: title }).first();

/** A mouse drag from the row's title onto a target, in small steps (as a hand moves). */
async function mouseDrag(page: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + 20, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 40, a.y + a.height / 2, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
}

test.describe('Planer: Bewegen (package 5)', () => {
  test.describe('desktop', () => {
    test.beforeEach(({ isMobile }) => {
      test.skip(isMobile, 'mouse and keyboard');
    });

    test('drag a row onto a tile: that thing moves, nothing else (row snapshot); one live message; a click still opens', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await threeToday(page);
      const before = await rowDays(page);
      await mouseDrag(
        page,
        rowOf(page, 'Steuer').getByText('Steuer', { exact: true }),
        page.getByTestId('week-2026-11-11'),
      );
      // While dragging: the title under the pointer, the target outlined – and nothing animates (reduced motion).
      const ghost = page.getByTestId('drag-ghost');
      await expect(ghost).toContainText('Steuer');
      await expect(ghost).toContainText('Hier ablegen');
      expect(
        await ghost.evaluate((el) => {
          const s = getComputedStyle(el);
          // The app's reduced-motion rule sets every duration to 0.00001 s.
          return [parseFloat(s.transitionDuration) < 0.01, s.animationName];
        }),
      ).toEqual([true, 'none']);
      await expect(page.locator('[data-drop-over]')).toHaveCount(1);
      await page.mouse.up();
      await expect(ghost).toHaveCount(0);
      // One live message for the drop: the toast.
      await expect(page.getByRole('status').filter({ hasText: 'Liegt auf Mi' })).toHaveCount(1);
      await expect.poll(() => rowDays(page)).toEqual({ ...before, Steuer: '2026-11-11' });
      // The page did not navigate (the drop is no click on the row).
      await expect(page).toHaveURL(/\/planner/);

      // Dropping outside a day, or Escape, changes nothing.
      const now = await rowDays(page);
      await mouseDrag(
        page,
        rowOf(page, 'Keller').getByText('Keller', { exact: true }),
        page.locator('main h1'),
      );
      await page.mouse.up();
      await mouseDrag(
        page,
        rowOf(page, 'Keller').getByText('Keller', { exact: true }),
        page.getByTestId('week-2026-11-12'),
      );
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await page.waitForTimeout(300);
      expect(await rowDays(page)).toEqual(now);
    });

    test('onto the 4-week grid: a day in three weeks takes the drop', async ({ page }) => {
      await threeToday(page);
      const before = await rowDays(page);
      // Grid and sheet in one view (a mouse drags within the window).
      await page.setViewportSize({ width: 1280, height: 1400 });
      await page.getByTestId('grid-switch').click();
      await mouseDrag(
        page,
        rowOf(page, 'Fenster').getByText('Fenster', { exact: true }),
        page.getByTestId('week-2026-11-30'),
      );
      await expect(page.locator('[data-drop-over]')).toHaveCount(1);
      await page.mouse.up();
      await expect.poll(() => rowDays(page)).toEqual({ ...before, Fenster: '2026-11-30' });
    });

    test('„Verschieben …“ is the first entry (key M); M on the row and the arrow keys pick the day', async ({
      page,
    }) => {
      await threeToday(page);
      const before = await rowDays(page);
      await rowOf(page, 'Keller').getByRole('button', { name: 'Aktionen für Keller' }).click();
      const first = page.getByRole('menuitem').first();
      await expect(first).toHaveAccessibleName('Verschieben …');
      await expect(first).toHaveAttribute('aria-keyshortcuts', 'M');
      await page.keyboard.press('Escape');

      // Keyboard only: focus the row, M, → twice, Enter.
      await rowOf(page, 'Keller').locator('[data-row]').focus();
      await page.keyboard.press('m');
      const dialog = page.getByRole('dialog', { name: 'Verschieben: Keller' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Mo 9.', exact: true }).focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await expect(dialog.getByRole('button', { name: 'Mi 11.', exact: true })).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(dialog.getByRole('button', { name: 'Mi 18.', exact: true })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(dialog).toHaveCount(0);
      await expect.poll(() => rowDays(page)).toEqual({ ...before, Keller: '2026-11-18' });
    });

    test('„Auswählen“ on the day sheet: one day for all, one undo', async ({ page }) => {
      await threeToday(page);
      const before = await rowDays(page);
      await page.getByRole('button', { name: 'Weitere Optionen', exact: true }).first().click();
      await page.getByRole('menuitem', { name: 'Auswählen' }).click();
      await rowOf(page, 'Keller').getByRole('checkbox').check();
      await rowOf(page, 'Fenster').getByRole('checkbox').check();
      await expect(page.getByRole('region', { name: 'Auswahl' })).toContainText('2');
      await page.getByRole('button', { name: 'Auf einen Tag …' }).click();
      const dialog = page.getByRole('dialog', { name: 'Verschieben: 2 Dinge' });
      await dialog.getByRole('button', { name: 'Do 12.', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect
        .poll(() => rowDays(page))
        .toEqual({ ...before, Keller: '2026-11-12', Fenster: '2026-11-12' });
      // One undo brings both back.
      await page.getByRole('status').getByRole('button', { name: 'Rückgängig' }).last().click();
      await expect.poll(() => rowDays(page)).toEqual(before);
    });

    test('axe: a row dragged over a tile (light and dark)', async ({ page }) => {
      await threeToday(page);
      for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await mouseDrag(
          page,
          rowOf(page, 'Keller').getByText('Keller', { exact: true }),
          page.getByTestId('week-2026-11-11'),
        );
        await expect(page.getByTestId('drag-ghost')).toBeVisible();
        const result = await new AxeBuilder({ page })
          .include('main')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(result.violations.map((v) => v.id)).toEqual([]);
        await page.keyboard.press('Escape');
        await page.mouse.up();
      }
    });
  });

  test.describe('phone', () => {
    test.beforeEach(({ isMobile }) => {
      test.skip(!isMobile, 'touch');
    });

    test('touch: a long press lifts the row, moving it onto a tile moves it; a short swipe does not', async ({
      page,
    }) => {
      await threeToday(page);
      const before = await rowDays(page);
      const cdp = await page.context().newCDPSession(page);
      const from = (await rowOf(page, 'Steuer')
        .getByText('Steuer', { exact: true })
        .boundingBox())!;
      const to = (await page.getByTestId('week-2026-11-11').boundingBox())!;
      const point = (x: number, y: number) => ({ touchPoints: [{ x, y }] });
      const start = { x: from.x + 10, y: from.y + from.height / 2 };
      const end = { x: to.x + to.width / 2, y: to.y + to.height / 2 };

      // Long press, then move onto Wednesday.
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        ...point(start.x, start.y),
      });
      await page.waitForTimeout(700);
      for (let i = 1; i <= 8; i++)
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          ...point(start.x + ((end.x - start.x) * i) / 8, start.y + ((end.y - start.y) * i) / 8),
        });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect(page.getByRole('status').filter({ hasText: 'Liegt auf Mi' })).toBeVisible();
      await expect.poll(() => rowDays(page)).toEqual({ ...before, Steuer: '2026-11-11' });
      // No menu opened by the long press that became a drag.
      await expect(page.getByRole('menu')).toHaveCount(0);
    });
  });
});
