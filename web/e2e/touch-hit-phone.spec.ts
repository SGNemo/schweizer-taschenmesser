import { expect, test } from '@playwright/test';
import { ready } from './helpers';

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
