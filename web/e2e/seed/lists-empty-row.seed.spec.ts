import { expect, type Page } from '@playwright/test';
import { test } from './helpers';
import { DESKTOP, openPage, PHONE, startSeeded } from './guards';

/**
 * Lists after 0b-8 follow-up 3 (`docs/design/ui-audit-2026-11/REPORT.md`, "Abnahme 0b-8"):
 * 1. An empty list's empty state names its next step (M10): a button that focuses the add field, the list's last row
 *    ("Artikel eintragen" on a shopping list, "Eintrag hinzufügen" on the others).
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

async function emptyStateLeadsToField(page: Page, name: string) {
  const button = page.getByTestId('lists-empty').getByRole('button', { name });
  await expect(button).toBeVisible();
  // Not a second filled button: "Neue Liste" in the head stays the page's one primary action.
  await expect(button).not.toHaveAttribute('data-variant', 'primary');
  await button.click();
  const field = page.getByTestId('lists-add').getByRole('textbox').first();
  await expect(field).toBeFocused();
  await expect(field).toBeInViewport();
}

test.describe('desktop', () => {
  test.use({ viewport: DESKTOP, seeded: { scale: 'small', desktop: true, preview: true } });

  test('an empty list names its next step and the button focuses the add field', async ({
    page,
  }) => {
    await startSeeded(page);
    await openEmptyList(page, 'Einkauf');
    await emptyStateLeadsToField(page, 'Artikel eintragen');
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

  test('an empty list names its next step and the button focuses the add field', async ({
    page,
  }) => {
    await startSeeded(page, { phone: true });
    // Not a shopping list: its entries are "Einträge", as in the "⋯" menu and the field's label.
    await openEmptyList(page, 'Checkliste');
    await emptyStateLeadsToField(page, 'Eintrag hinzufügen');
  });
});
