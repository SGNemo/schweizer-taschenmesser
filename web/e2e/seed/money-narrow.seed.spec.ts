import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test } from './helpers';
import { openPage, startSeeded } from './guards';

/**
 * Master–detail lists beside their detail panel on windows between the phone and the full desktop (design check of
 * packages 0b-1 to 0b-3, finding G1): at 1280 × 720 the text of an invoice row was 26 px wide and the row 386 px
 * high, because the row may only wrap below a window width while the panel takes its share at every width. Per
 * width and page: the text of every row keeps at least 9 rem, no row is higher than 120 px, nothing
 * scrolls sideways; and the row the panel shows carries a visible mark on an urgent row too (finding G2).
 *
 * `MONEY_NARROW_SHOTS=<dir>` also writes a picture per width (for the pull request).
 */
const WIDTHS = [1100, 1280, 1366, 1536] as const;
const HEIGHT = 800;
/** 9 rem at the 16-px root of these windows. */
const TEXT_MIN = 144;
/** The tallest row at the 9-rem floor: a title of two lines above a meta line that wraps to three. */
const ROW_MAX = 120;
const SHOTS = process.env.MONEY_NARROW_SHOTS;

interface Read {
  rows: { title: string; text: number; height: number }[];
  current: { title: string; background: string }[];
  panel: boolean;
  sideways: boolean;
}

/** Runs in the page. */
function read(): Read {
  const main = document.querySelector('main')!;
  const rows = [...main.querySelectorAll<HTMLElement>('li [data-row]')].filter(
    (el) => el.getBoundingClientRect().height > 0,
  );
  const title = (el: HTMLElement) => (el.innerText.split('\n')[0] ?? '').trim();
  return {
    rows: rows.map((el) => ({
      title: title(el),
      text: Math.round(el.getBoundingClientRect().width),
      height: Math.round(el.closest('li')!.getBoundingClientRect().height),
    })),
    current: rows
      .filter((el) => el.getAttribute('aria-current') === 'true')
      .map((el) => {
        // What is painted behind the text: the first filled box from the row's button up to its list item (a
        // swipeable row is opaque and covers the item's own tone).
        let background = 'rgba(0, 0, 0, 0)';
        for (let n: HTMLElement | null = el; n; n = n.parentElement) {
          background = getComputedStyle(n).backgroundColor;
          if (background !== 'rgba(0, 0, 0, 0)' || n.tagName === 'LI') break;
        }
        return { title: title(el), background };
      }),
    panel: !!main.querySelector('aside'),
    sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
}

async function settle(page: Page) {
  const notice = page.getByRole('button', { name: 'Schließen', exact: true });
  if (await notice.count()) await notice.first().click();
  await expect(page.locator('main li [data-row]').first()).toBeVisible();
  await page.waitForTimeout(400);
}

test.describe('money lists beside the detail panel', () => {
  test.use({ seeded: { scale: 'medium', desktop: true, preview: true } });

  for (const width of WIDTHS) {
    test(`rows keep their text at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      await startSeeded(page);
      const sunken = await page.evaluate(() => {
        const probe = document.createElement('span');
        probe.style.background = 'var(--surface-sunken)';
        document.body.append(probe);
        const value = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return value;
      });

      // Rechnungen shows the first invoice in the panel from the start; that row is an overdue one in the seed.
      await openPage(page, '/invoices');
      await settle(page);
      const invoices = await page.evaluate(read);
      // Finanzen shows the booking that was picked.
      await openPage(page, '/finance?tab=transactions');
      await settle(page);
      await page.locator('main li [data-row]').first().click();
      await expect(page.locator('main aside')).toBeVisible();
      const finance = await page.evaluate(read);
      if (SHOTS) {
        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: join(SHOTS, `finance-${width}.png`) });
        await openPage(page, '/invoices');
        await settle(page);
        await page.screenshot({ path: join(SHOTS, `invoices-${width}.png`) });
      }

      for (const [name, r] of [
        ['/invoices', invoices],
        ['/finance', finance],
      ] as const) {
        expect(r.panel, `${name}: the detail panel is shown`).toBe(true);
        expect.soft(r.sideways, `${name}: the page scrolls sideways`).toBe(false);
        expect(r.rows.length, `${name}: rows`).toBeGreaterThan(0);
        for (const row of r.rows) {
          expect
            .soft(row.text, `${name}: text of "${row.title}" is ${row.text} px wide`)
            .toBeGreaterThanOrEqual(TEXT_MIN);
          expect
            .soft(row.height, `${name}: row "${row.title}" is ${row.height} px high`)
            .toBeLessThanOrEqual(ROW_MAX);
        }
        expect.soft(r.current, `${name}: one row is the panel's entry`).toHaveLength(1);
        expect
          .soft(r.current[0]?.background, `${name}: the panel's row carries the sunken tone`)
          .toBe(sunken);
      }
    });
  }
});

// Package 0b-4b, part 1: the master–detail pages of the plan area keep the same floor at the same widths.
test.describe('plan lists beside the detail panel', () => {
  test.use({ seeded: { scale: 'medium', desktop: true, preview: true } });

  for (const width of WIDTHS) {
    test(`Personen, Gewohnheiten and Zeiterfassung keep their text at ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      await startSeeded(page);
      for (const path of ['/people', '/habits', '/timetrack']) {
        await openPage(page, path);
        await settle(page);
        // All three show their first row in the panel from the start.
        await expect(page.locator('main aside')).toBeVisible();
        const r = await page.evaluate(read);
        if (SHOTS) {
          mkdirSync(SHOTS, { recursive: true });
          await page.screenshot({ path: join(SHOTS, `${path.slice(1)}-${width}.png`) });
        }
        expect.soft(r.sideways, `${path}: the page scrolls sideways`).toBe(false);
        expect(r.rows.length, `${path}: rows`).toBeGreaterThan(0);
        for (const row of r.rows) {
          expect
            .soft(row.text, `${path}: text of "${row.title}" is ${row.text} px wide`)
            .toBeGreaterThanOrEqual(TEXT_MIN);
          expect
            .soft(row.height, `${path}: row "${row.title}" is ${row.height} px high`)
            .toBeLessThanOrEqual(ROW_MAX);
        }
        expect.soft(r.current, `${path}: one row is the panel's entry`).toHaveLength(1);
      }
    });
  }
});
