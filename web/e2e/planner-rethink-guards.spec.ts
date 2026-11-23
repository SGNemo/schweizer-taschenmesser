import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { enable, ready, showPreview } from './helpers';

/**
 * Planner rethink package 2 – accessibility, contrast and touch of the new states: the lock on a row, the over line
 * „… mehr als planbar · Rest verteilen“, the chips „Vorschlag“ and „In ToDos“, the spread preview. Both colour schemes;
 * the lock's 44 × 44 hit area on the phone. Deterministic "today": Tuesday 2026-09-29, 10:00.
 */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
  await showPreview(page);
});

/** One record straight into a module table (with the envelope), as a module would store it. */
async function putRecord(page: Page, table: string, record: Record<string, unknown>) {
  await page.evaluate(
    ({ name, rec }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(name, 'readwrite');
          tx.objectStore(name).put({
            createdAt: 1,
            updatedAt: 1,
            deviceId: 'e2e',
            deletedAt: null,
            _f: {},
            ...rec,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { name: table, rec: record },
  );
}

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    label,
  ).toEqual([]);
}

/** The planner with ToDos and invoices on (raw module states, like the library would write them). */
async function plannerOn(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  for (const id of ['todos', 'planner', 'invoices'])
    await putRecord(page, '_modules', { id, enabled: true, dataPolicy: null });
}

async function enter(page: Page, line: string) {
  const field = page.getByRole('textbox', { name: 'Eintragen oder sagen', exact: true });
  await field.fill(line);
  await field.press('Enter');
  await expect(field).toHaveValue('');
}

for (const scheme of ['light', 'dark'] as const) {
  test(`axe: the lock, the over line, the chips „Vorschlag“ and „In ToDos“, the spread preview (${scheme})`, async ({
    page,
    isMobile,
  }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await plannerOn(page);
    // A deadline without a day (its chip) and a date set in ToDos (its muted row on Thursday).
    await putRecord(page, 'invoices_invoice', {
      id: 'guard-inv',
      payee: 'Strom',
      amountMinor: 4200,
      dueDate: '2026-10-02',
      status: 'open',
    });
    await putRecord(page, 'todos_list', { id: 'inbox', name: 'Eingang', order: 0 });
    await putRecord(page, 'todos_task', {
      id: 'guard-arzt',
      listId: 'inbox',
      title: 'Arzt anrufen',
      done: false,
      priority: 0,
      order: 0,
      plannedFor: '2026-10-01',
    });
    await page.goto('/planner');
    for (const line of ['Umzug 5 Std', 'Zahnarzt Di fest']) await enter(page, line);
    await expect(page.getByTestId('planner-over-line')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Fest an diesem Tag: Zahnarzt' }),
    ).toHaveAttribute('aria-pressed', 'true');
    // The phone shows the lock only on a row that is „fest“ (its stimulus budget); wider pages on every row.
    const open = page.getByRole('button', { name: 'Fest an diesem Tag: Umzug' });
    if (isMobile) await expect(open).toHaveCount(0);
    else await expect(open).toHaveAttribute('aria-pressed', 'false');
    const wait = page.locator('[data-group="wait"] h2').getByRole('button');
    if ((await wait.getAttribute('aria-expanded')) !== 'true') await wait.click();
    await expect(page.getByTestId('proposal-chip')).toBeVisible();
    await audit(page, `lock, over line, proposal chip (${scheme})`);
    await page.getByTestId('week-2026-10-01').click();
    await expect(page.getByTestId('todo-hint-place')).toBeVisible();
    await audit(page, `muted row „In ToDos“ (${scheme})`);
    await page.getByTestId('week-2026-09-29').click();
    await page
      .getByTestId('planner-over-line')
      .getByRole('button', { name: 'Rest verteilen' })
      .click();
    await expect(page.getByTestId('plan-preview')).toBeVisible();
    await audit(page, `spread preview (${scheme})`);
  });

  test(`contrast: „… mehr als planbar“ reads at AA in its warm box, no symbol (${scheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await enable(page, 'todos');
    await enable(page, 'planner');
    await ready(page, '/planner');
    await enter(page, 'Umzug 5 Std');
    const line = page.getByTestId('planner-over-line');
    await expect(line).toHaveText(/^1 h 48 mehr als planbarRest verteilen$/);
    await expect(line.locator('svg')).toHaveCount(0);
    // Direction A: the warm box (a semi-transparent tint) – axe weighs the text against the blended background.
    const results = await new AxeBuilder({ page })
      .include('[data-testid="planner-over-line"]')
      .withRules(['color-contrast'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test.describe('phone', () => {
  test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });

  test('the lock on a row reacts on 44 × 44 px', async ({ page }) => {
    await enable(page, 'todos');
    await enable(page, 'planner');
    await ready(page, '/planner');
    await enter(page, 'Keller 30 Min');
    // The phone keeps its stimulus budget: an open row is locked from ⋯; a row that is „fest“ carries the lock.
    const lock = page.getByRole('button', { name: 'Fest an diesem Tag: Keller' });
    await expect(lock).toHaveCount(0);
    await page.getByRole('button', { name: 'Aktionen für Keller' }).tap();
    await page.getByRole('menuitem', { name: 'Fest an diesem Tag' }).tap();
    await expect(lock).toHaveAttribute('aria-pressed', 'true');
    const box = await lock.evaluate((el) => {
      const b = el.getBoundingClientRect();
      const hits = (x: number, y: number) => {
        const h = document.elementFromPoint(x, y);
        return !!h && (h === el || el.contains(h));
      };
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      let top = b.top;
      while (hits(cx, top - 1) && top > b.top - 10) top -= 1;
      let bottom = b.bottom;
      while (hits(cx, bottom) && bottom < b.bottom + 10) bottom += 1;
      let left = b.left;
      while (hits(left - 1, cy) && left > b.left - 10) left -= 1;
      let right = b.right;
      while (hits(right, cy) && right < b.right + 10) right += 1;
      return { height: bottom - top, width: right - left };
    });
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    // One tap releases it.
    await lock.tap();
    await expect(lock).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Nicht mehr fest' })).toBeVisible();
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test(`axe: the band's row and the 4-week grid with a passed day (${scheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await plannerOn(page);
    await page.goto('/planner');
    await enter(page, 'Keller 30 Min');
    await expect(page.getByRole('status').filter({ hasText: 'Liegt auf Di' })).toBeVisible();
    // Sunday: the grid starts on Monday 28 Sep, so whatever was placed this week has passed.
    await page.clock.setFixedTime(new Date('2026-10-04T10:00:00'));
    await page.goto('/planner');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Direction A: the switch „Woche | 4 Wochen“ stands in the band's row, on the phone too.
    await page.getByTestId('grid-switch').getByRole('button', { name: '4 Wochen' }).click();
    await expect(page.getByRole('grid', { name: 'Vier Wochen' })).toBeVisible();
    await expect(page.getByTestId('week-2026-09-29')).toHaveAccessibleName(
      'Dienstag, 29. September: offen',
    );
    await audit(page, `band row and grid (${scheme})`);
    // 412 px: no sideways scroll.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
