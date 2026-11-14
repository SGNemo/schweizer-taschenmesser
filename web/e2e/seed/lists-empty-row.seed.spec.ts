import { expect, type Page } from '@playwright/test';
import { test } from './helpers';
import { DESKTOP, openPage, PHONE, startSeeded } from './guards';

/**
 * Lists after 0b-8 follow-up 3 (`docs/design/ui-audit-2026-11/REPORT.md`, "Abnahme 0b-8"):
 * 1. An empty list's next step is its first entry (M10, follow-up (a) of "Abschlussmessung 2"): one way in – the add
 *    field right under the empty state, its button with the verb ("Artikel eintragen" on a shopping list, "Eintragen"
 *    on the others). On the desktop that button is the filled one and "Neue Liste" steps back; on the phone the plus
 *    stays "Neue Liste" (decided) and the button is outlined. No head figure ("0 offen · 1 Ladenbereich").
 * 2. On the phone a row keeps its pencil on the same line as the entry, ticked rows included (before, a row with price
 *    and quantity broke the pencil onto a second line and was twice as high).
 */

async function openEmptyList(page: Page, kind: 'Einkauf' | 'Checkliste') {
  await openPage(page, '/lists');
  await page.getByRole('button', { name: 'Neue Liste' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name der Liste').fill('Leere Liste');
  await dialog.getByLabel('Art').selectOption({ label: kind });
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('lists-empty')).toBeVisible();
}

async function emptyStateLeadsToField(page: Page, name: string, phone: boolean) {
  // One way in: the empty state holds no button of its own.
  await expect(page.getByTestId('lists-empty').getByRole('button')).toHaveCount(0);
  await expect(page.getByTestId('lists-open')).toHaveCount(0);
  const add = page.getByTestId('lists-add');
  const button = add.getByRole('button', { name });
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute('data-variant', phone ? 'secondary' : 'primary');
  if (!phone)
    await expect(page.locator('[data-page-action]')).toHaveAttribute('data-variant', 'secondary');
  const field = add.getByRole('textbox').first();
  await expect(field).toBeInViewport();
  // The field follows the empty state, not the bottom edge of the window.
  const gap = await page.evaluate(() => {
    const empty = document.querySelector('[data-testid="lists-empty"]')!.getBoundingClientRect();
    const form = document.querySelector('[data-testid="lists-add"]')!.getBoundingClientRect();
    return form.top - empty.bottom;
  });
  expect(gap).toBeLessThan(80);
  await field.fill('Milch');
  await button.click();
  await expect(page.getByTestId('lists-empty')).toHaveCount(0);
  await expect(add.getByRole('button', { name })).toHaveAttribute('data-variant', 'ghost');
}

test.describe('desktop', () => {
  test.use({ viewport: DESKTOP, seeded: { scale: 'small', desktop: true, preview: true } });

  test('an empty list has one way in: the add field and its filled button', async ({ page }) => {
    await startSeeded(page);
    await openEmptyList(page, 'Einkauf');
    await emptyStateLeadsToField(page, 'Artikel eintragen', false);
  });

  test('a ticked entry is grey, not the accent, and prices are not in mono', async ({ page }) => {
    await startSeeded(page);
    await openPage(page, '/lists');
    const look = await page.evaluate(() => {
      const box = document.querySelector('main input[data-row-tick]:checked')!;
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      const probe = document.createElement('i');
      probe.style.color = accent;
      document.body.append(probe);
      const accentRgb = getComputedStyle(probe).color;
      probe.remove();
      const price = [...document.querySelectorAll('[data-testid="receipt-paper"] li span')].find(
        (el) => /€/.test(el.textContent ?? '') && el.children.length === 0,
      );
      return {
        fill: getComputedStyle(box).backgroundColor,
        accentRgb,
        font: price ? getComputedStyle(price).fontFamily : '',
      };
    });
    expect(look.fill).not.toBe(look.accentRgb);
    expect(look.font, 'the seed has a priced row').not.toBe('');
    expect(look.font).not.toMatch(/mono/i);
  });
});

test.describe('phone', () => {
  test.use({
    viewport: PHONE,
    isMobile: true,
    hasTouch: true,
    seeded: { scale: 'small', preview: true },
  });

  test('the pencil stays in the row, ticked rows included', async ({ page }) => {
    await startSeeded(page, { phone: true });
    await openPage(page, '/lists');
    const rows = page.locator('main li:has([data-row-tick])');
    await expect(rows.first()).toBeVisible();
    const measured = await rows.evaluateAll((els) =>
      els.map((li) => {
        const box = (sel: string) => li.querySelector(sel)!.getBoundingClientRect();
        const main = box('[data-row]');
        const pencil = box('[data-row-actions]');
        const meta = li.querySelector('[data-row] + *')?.getBoundingClientRect();
        return {
          name: (li.querySelector('[data-row]')!.textContent ?? '').trim(),
          done: (li.querySelector('input[data-row-tick]') as HTMLInputElement | null)?.checked,
          height: Math.round(li.getBoundingClientRect().height),
          // Same line: the pencil's middle lies within the entry's button, and right of it.
          sameLine:
            pencil.top + pencil.height / 2 >= main.top &&
            pencil.top + pencil.height / 2 <= main.bottom &&
            pencil.left >= main.right,
          // Never pushed past the screen's edge.
          inside: pencil.right <= document.documentElement.clientWidth,
          // Badges, price and quantity end before the pencil, never under it.
          clear: !meta || meta.width === 0 || meta.right <= pencil.left,
        };
      }),
    );
    expect(
      measured.some((r) => r.done),
      'the seed has a ticked row',
    ).toBe(true);
    for (const r of measured) {
      expect.soft(r.sameLine, `${r.name}: pencil beside the entry`).toBe(true);
      expect.soft(r.inside, `${r.name}: pencil on screen`).toBe(true);
      expect.soft(r.clear, `${r.name}: nothing covers the pencil`).toBe(true);
      expect.soft(r.height, `${r.name}: row height`).toBeGreaterThanOrEqual(48);
    }
  });

  test('an empty list has one way in: the add field and its button', async ({ page }) => {
    await startSeeded(page, { phone: true });
    await openEmptyList(page, 'Checkliste');
    await emptyStateLeadsToField(page, 'Eintragen', true);
  });
});
