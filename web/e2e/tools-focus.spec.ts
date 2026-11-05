import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/**
 * Focus in the tools panel: it lands on a sensible target (search, or the tool's own `data-autofocus` field), the ring is
 * never clipped and never drawn round the whole tool, Alt+1…9 works from anywhere in the dialog, and closing gives focus
 * back to the trigger.
 */

const trigger = (page: Page) =>
  page.getByRole('banner').getByRole('button', { name: 'Werkzeuge', exact: true });
const dialog = (page: Page) => page.getByRole('dialog');
const search = (page: Page) =>
  dialog(page).getByRole('searchbox', { name: 'Werkzeuge durchsuchen' });

/** The focused element: inside a tool's surface? its `data-autofocus` mark? the surface itself? */
const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    const stage = el?.closest('section[data-tool]') as HTMLElement | null;
    return {
      tool: stage?.dataset.tool ?? null,
      autofocus: !!el?.hasAttribute('data-autofocus'),
      isSurface: !!el && el === stage,
      label: el?.getAttribute('aria-label') ?? '',
    };
  });

test.describe('desktop', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('opening lands in the search with its whole ring, Alt+2 in the tool’s field, Esc back on the trigger', async ({
    page,
  }) => {
    await ready(page, '/todos');
    await trigger(page).click();
    await expect(search(page)).toBeFocused();
    // The scrolling list leaves room for the ring (2 px + 2 px offset) on every side of the field.
    const room = await search(page).evaluate((input) => {
      const r = input.getBoundingClientRect();
      const n = input.closest('nav')!.getBoundingClientRect();
      return Math.round(Math.min(r.left - n.left, r.top - n.top, n.right - r.right));
    });
    expect(room).toBeGreaterThanOrEqual(4);

    // Alt+2 from the search: the tool shows and focus follows into it (its amount field once the rates are there,
    // the surface before); Alt+1 → the calculator's own input.
    await page.keyboard.press('Alt+Digit2');
    await expect(dialog(page).getByRole('heading', { name: 'Währung' })).toBeVisible();
    await expect.poll(() => focused(page)).toMatchObject({ tool: 'currency' });
    await page.keyboard.press('Alt+Digit1');
    await expect(dialog(page).getByRole('heading', { name: 'Rechner' })).toBeVisible();
    await expect.poll(() => focused(page)).toMatchObject({ tool: 'calc', autofocus: true });

    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
  });

  test('a tool opened from the palette gets focus in its own field, not in the panel search', async ({
    page,
  }) => {
    await ready(page, '/todos');
    await page.keyboard.press('Control+k');
    const box = page.getByRole('combobox', { name: /Suchen, springen/ });
    await expect(box).toBeFocused();
    await box.fill('Rechner');
    await page.getByRole('option', { name: 'Werkzeug: Rechner', exact: true }).click();
    await expect(dialog(page).getByRole('heading', { name: 'Rechner' })).toBeVisible();
    await expect.poll(() => focused(page)).toMatchObject({ tool: 'calc', autofocus: true });
    await expect(search(page)).not.toBeFocused();
  });

  test('a tool surface that takes focus draws no ring round the whole tool', async ({ page }) => {
    await ready(page, '/todos');
    await trigger(page).click();
    await page.keyboard.press('Alt+Digit2');
    const surface = page.locator('section[data-tool="currency"]');
    await expect(surface).toBeVisible();
    // Keyboard modality (as after Alt+digit), then focus on the surface itself: it matches :focus-visible, yet no ring.
    await page.keyboard.press('Shift');
    const ring = await surface.evaluate((s) => {
      s.focus();
      return { visible: s.matches(':focus-visible'), outline: getComputedStyle(s).outlineStyle };
    });
    expect(ring).toEqual({ visible: true, outline: 'none' });
  });
});

test.describe('phone layout with a keyboard (narrow window)', () => {
  test.use({ viewport: { width: 820, height: 1000 } });

  test('opening lands in the panel, not on the close button; Alt+1…9 work from the dialog head too', async ({
    page,
  }) => {
    await ready(page, '/todos');
    await trigger(page).focus();
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeVisible();
    const close = dialog(page).getByRole('button', { name: 'Schließen' });
    await expect(close).not.toBeFocused();
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.closest('[data-pane]')))
      .toBe(true);

    await page.keyboard.press('Alt+Digit2');
    await expect(dialog(page).getByRole('heading', { name: 'Währung' })).toBeVisible();
    // From the close button in the head, the digits still pick a tool.
    await close.focus();
    await page.keyboard.press('Alt+Digit1');
    await expect(dialog(page).getByRole('heading', { name: 'Rechner' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
  });
});
