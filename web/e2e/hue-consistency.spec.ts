import { expect, test, type Locator } from '@playwright/test';
import { ready } from './helpers';

/** The computed fill of a plate: the hue colour, the same in every list. */
const fill = (plate: Locator) => plate.evaluate((el) => getComputedStyle(el).backgroundColor);

test.describe('one colour language for modules and tools', () => {
  test('a module has the same plate colour in library, settings list and settings head', async ({
    page,
  }) => {
    await ready(page, '/library');
    const lib = page.getByTestId('module-todos').locator('[data-size="lg"][data-hue]');
    await expect(lib).toBeVisible();
    const hue = await lib.getAttribute('data-hue');
    const libFill = await fill(lib);
    expect(libFill).not.toBe('rgba(0, 0, 0, 0)');

    await ready(page, '/settings/module');
    const row = page.getByTestId('module-link-todos').locator('[data-hue]');
    await expect(row).toHaveAttribute('data-hue', hue!);
    expect(await fill(row)).toBe(libFill);

    await ready(page, '/settings/module/todos');
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('main [data-hue="' + hue + '"]').first()).toBeAttached();
  });

  test('a tool has the same plate in the tool library and in the tools settings', async ({
    page,
  }) => {
    await ready(page, '/tools');
    const card = page.locator('[data-testid^="tool-"][data-hue]').first();
    const plate = card.locator('[data-size="lg"][data-hue]');
    await expect(plate).toBeVisible();
    const hue = await plate.getAttribute('data-hue');
    const libFill = await fill(plate);

    await ready(page, '/settings/werkzeuge');
    const row = page.locator(`[id^="tools--"] [data-hue="${hue}"]`).first();
    await expect(row).toBeVisible();
    expect(await fill(row)).toBe(libFill);
  });

  test('"Modulfarben: Aus" flattens the plates to one grey', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tm-module-colors', 'off'));
    await ready(page, '/library');
    const plates = page.locator('[data-testid^="module-"] [data-size="lg"][data-hue]');
    await expect(plates.first()).toBeVisible();
    const a = await fill(plates.nth(0));
    const b = await fill(plates.nth(1));
    expect(a).toBe(b);
  });
});
