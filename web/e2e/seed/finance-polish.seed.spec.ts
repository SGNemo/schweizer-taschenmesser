import { expect } from '@playwright/test';
import { test } from './helpers';
import { PHONE, openPage, startSeeded } from './guards';

/**
 * Finance polish (round "Tiefe & Politur", p1) on the phone with the medium seed: a booking row keeps its amount and
 * its "⋯" on one line (an income of four digits pushed "⋯" alone under the amount), and the breakdown line above the
 * figures breaks only between its parts, never inside an amount.
 */
test.use({
  viewport: PHONE,
  isMobile: true,
  hasTouch: true,
  seeded: { scale: 'medium', preview: true },
});

test('booking rows: amount and "⋯" stay side by side', async ({ page }) => {
  await startSeeded(page, { phone: true });
  await openPage(page, '/finance?tab=transactions');
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('main li')]
      .map((li) => {
        const row = li.firstElementChild as HTMLElement | null;
        const amount = row?.querySelector<HTMLElement>('[class*="amount"]');
        const menu = row?.lastElementChild as HTMLElement | null;
        if (!amount || !menu || amount === menu) return null;
        const a = amount.getBoundingClientRect();
        const m = menu.getBoundingClientRect();
        // Same line: the vertical middles lie within the menu's height.
        return {
          text: amount.textContent,
          apart: Math.abs(a.top + a.height / 2 - (m.top + m.height / 2)),
        };
      })
      .filter((r) => r !== null),
  );
  expect(rows.length).toBeGreaterThan(5);
  for (const r of rows) expect(r.apart, `row with ${r.text}`).toBeLessThan(20);
});

test('breakdown line: every part on one line', async ({ page }) => {
  await startSeeded(page, { phone: true });
  await openPage(page, '/finance');
  const parts = page.getByTestId('hero-breakdown').locator('span[class*="nowrap"]');
  await expect(parts.first()).toBeVisible();
  for (const part of await parts.all()) {
    const lines = await part.evaluate((el) => el.getClientRects().length);
    expect(lines, (await part.textContent()) ?? '').toBe(1);
  }
});
