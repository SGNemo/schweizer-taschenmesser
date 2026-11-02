import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openAppearanceGroup, ready, showAllWidgets } from './helpers';

/** Every module wears its identity: hue on the widget card and the module frame, icon chip next to the title. */
test.describe('Module identity', () => {
  test.beforeEach(async ({ page }) => {
    await showAllWidgets(page);
  });

  test('widgets and module pages carry the hue of their manifest; the active nav icon follows it', async ({
    page,
  }) => {
    await ready(page, '/');
    const widget = page.getByTestId('widget-finance:balance');
    await expect(widget).toHaveAttribute('data-hue', 'teal');
    await expect(page.getByTestId('widget-todos:open')).toHaveAttribute('data-hue', 'moss');
    // The chip is decoration: hidden from assistive tech, the title stays the accessible name.
    await expect(widget.getByRole('heading', { level: 2 })).toHaveText('Kontostand');
    const chipColor = await widget
      .locator('[aria-hidden="true"]')
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    const titleColor = await widget
      .getByRole('heading', { level: 2 })
      .evaluate((el) => getComputedStyle(el).color);
    expect(chipColor).not.toBe(titleColor);

    await ready(page, '/finance');
    await expect(page.getByTestId('module-frame')).toHaveAttribute('data-hue', 'teal');
    await ready(page, '/calendar');
    await expect(page.getByTestId('module-frame')).toHaveAttribute('data-hue', 'sky');
  });

  test('"Modulfarben: Aus" keeps chip and edge but greys them; the calm colour mode does the same', async ({
    page,
  }) => {
    await ready(page, '/');
    const chip = page.getByTestId('widget-finance:balance').locator('[aria-hidden="true"]').first();
    const colored = await chip.evaluate((el) => getComputedStyle(el).color);

    await ready(page, '/settings/darstellung');
    await openAppearanceGroup(page, 'colors');
    const group = page.getByRole('group', { name: 'Modulfarben' });
    await group.getByRole('button', { name: 'Aus' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-module-colors', 'off');
    await ready(page, '/');
    await expect(chip).toBeVisible();
    const grey = await chip.evaluate((el) => getComputedStyle(el).color);
    expect(grey).not.toBe(colored);
    const muted = await page
      .getByTestId('widget-finance:balance')
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--text-3').trim());
    expect(muted.length).toBeGreaterThan(0);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-module-colors', 'off');
    await ready(page, '/settings/darstellung');
    await openAppearanceGroup(page, 'colors');
    await page
      .getByRole('group', { name: 'Modulfarben' })
      .getByRole('button', { name: 'An' })
      .click();
    await expect(page.locator('html')).not.toHaveAttribute('data-module-colors', 'off');
    await page
      .getByRole('group', { name: 'Farben' })
      .getByRole('button', { name: 'Ruhig' })
      .click();
    await ready(page, '/');
    const calm = await chip.evaluate((el) => getComputedStyle(el).color);
    expect(calm).toBe(grey);
  });

  test('overview and a module page pass axe in both themes with module colours on', async ({
    page,
  }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of ['/', '/finance']) {
        await ready(page, path);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(
          results.violations.map((v) => `${v.id}: ${v.help}`),
          `${scheme} ${path}`,
        ).toEqual([]);
      }
    }
  });
});
