import { expect, test } from '@playwright/test';
import { enable, ready, showPreview } from './helpers';

/** Erstkontakt-Runde, person C (C09): coarse touch needs a real 44 px hit area, not only a 44 px look. */
test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });

test('C09: the overview switch „Ruhig / Ausführlich“ reacts on 44 px', async ({ page }) => {
  await ready(page, '/');
  const group = page.getByRole('group', { name: 'Übersicht' });
  for (const name of ['Ruhig', 'Ausführlich']) {
    const button = group.getByRole('button', { name, exact: true });
    const height = await button.evaluate((el) => {
      const b = el.getBoundingClientRect();
      const x = b.left + b.width / 2;
      const hits = (y: number) => {
        const h = document.elementFromPoint(x, y);
        return !!h && (h === el || el.contains(h));
      };
      let top = b.top;
      while (hits(top - 1) && top > b.top - 10) top -= 1;
      let bottom = b.bottom;
      while (hits(bottom) && bottom < b.bottom + 10) bottom += 1;
      return bottom - top;
    });
    expect(height, name).toBeGreaterThanOrEqual(44);
  }
});

test('planner rethink package 2: the lock on a row reacts on 44 × 44 px', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
  await showPreview(page);
  await enable(page, 'todos');
  await enable(page, 'planner');
  await ready(page, '/planner');
  const field = page.getByRole('textbox', { name: 'Eintragen oder sagen', exact: true });
  await field.fill('Keller 30 Min');
  await field.press('Enter');
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
