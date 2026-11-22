import { expect } from '@playwright/test';
import { bootDev, test } from './helpers';

/**
 * Planner rethink package 2 on the seeded app: a thing with a deadline and no day (the seed's invoices and
 * cancellations) waits under „Noch ohne Tag“ with the chip „Vorschlag: Do · Frist Fr“; one tap on „Übernehmen“
 * lays it on that day and nothing else. (`dunning-chain.seed.spec.ts` keeps asserting that nothing lays the invoice
 * by itself.)
 */
test.describe('planner: proposal chip on seeded deadline things', () => {
  test.setTimeout(90_000);
  test.use({
    seeded: { scale: 'medium', desktop: true, preview: true },
    viewport: { width: 1440, height: 900 },
  });

  test('a deadline thing without a day shows „Vorschlag: … · Frist …“; one tap lays it there', async ({
    page,
  }) => {
    await bootDev(page);
    await page.goto('/planner');
    const waiting = page.locator('[data-group="wait"] h2').getByRole('button');
    await expect(waiting).toBeVisible();
    if ((await waiting.getAttribute('aria-expanded')) !== 'true') await waiting.click();
    const chip = page.getByTestId('proposal-chip').first();
    await expect(chip).toContainText(/^Vorschlag: \p{L}{2} · Frist \p{L}{2}/u);
    const take = chip.getByRole('button', { name: /^Übernehmen: / });
    const name = (await take.getAttribute('aria-label'))!;
    // „Übernehmen: <Titel> auf <Tag>“: the thing and its proposed day.
    const [, title, day] = /^Übernehmen: (.+) auf (\p{L}{2})$/u.exec(name)!;
    await take.click();
    await expect(page.getByRole('status').filter({ hasText: `Liegt auf ${day}` })).toBeVisible();
    // It left „Noch ohne Tag“: no chip names it any more.
    await expect(page.getByRole('button', { name: `Übernehmen: ${title} auf ${day}` })).toHaveCount(
      0,
    );
  });
});
