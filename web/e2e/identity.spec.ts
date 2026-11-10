import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { enable, openAppearanceGroup, ready, showAllWidgets, showPreview } from './helpers';

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

  test('Identity 4.0: a standard head has no signature slot (a block the page brings lies in the page), the stage keeps its slot; nothing of either disappears on the phone', async ({
    page,
  }) => {
    // Left edge of an element, measured from the page container's left edge, in rem of the current root size.
    const startOf = (selector: string) =>
      page.evaluate((sel) => {
        const el = document.querySelector(sel);
        const pageEl = document.querySelector('[data-testid="page"]');
        if (!el || !pageEl) return null;
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        return (el.getBoundingClientRect().left - pageEl.getBoundingClientRect().left) / rem;
      }, selector);
    for (const width of [1920, 2560]) {
      await page.setViewportSize({ width, height: 1080 });
      for (const path of ['/finance', '/calendar', '/todos']) {
        await ready(page, path);
        const frame = page.getByTestId('module-frame');
        await expect(frame, `${path} @${width}`).toHaveAttribute('data-head', 'standard');
        await expect(frame, `${path} @${width}`).toHaveAttribute('data-slot', 'none');
        // The frame draws no signature into a standard head, and the page's own block is not in it either.
        await expect(frame.getByTestId('module-signature'), `${path} @${width}`).toHaveCount(0);
        await expect(frame.locator('[data-signature]'), `${path} @${width}`).toHaveCount(0);
        // The title row starts at the page's left edge (the head is as wide as the content).
        const start = await startOf('[data-testid="module-title-row"]');
        expect(start, `${path} @${width}: title row start`).not.toBeNull();
        expect(
          Math.abs(start!),
          `${path} @${width}: the title row starts at the page edge`,
        ).toBeLessThan(1);
      }
      // The stage keeps its slot: the frame's own signature (the sky mark) or the page's block, on the stage.
      await ready(page, '/weather');
      const stage = page.getByTestId('module-frame');
      await expect(stage, `/weather @${width}`).toHaveAttribute('data-head', 'stage');
      await expect(stage, `/weather @${width}`).toHaveAttribute('data-slot', 'L');
      await expect(stage.getByTestId('module-signature'), `/weather @${width}`).toBeVisible();
      const slot = await startOf('[data-testid="module-signature"]');
      expect(
        slot!,
        `/weather @${width}: the slot starts within 40 rem of the page's left edge`,
      ).toBeLessThanOrEqual(40);
      expect(slot!, `/weather @${width}: the slot is not left of the page`).toBeGreaterThanOrEqual(
        -1,
      );
    }
    // Phone: nothing a page brings for the old slot is display: none, wherever it lies now. Notes and chat bring
    // their own blocks, which used to hide themselves below 720 px.
    await page.setViewportSize({ width: 1280, height: 800 });
    await showPreview(page); // chat is a preview module: visible in the library only with "In Arbeit anzeigen"
    await enable(page, 'notes');
    await enable(page, 'chat');
    await enable(page, 'timetrack');
    await page.setViewportSize({ width: 412, height: 915 });
    for (const path of [
      '/finance',
      '/calendar',
      '/todos',
      '/notes',
      '/chat',
      '/timetrack',
      '/weather',
    ]) {
      await ready(page, path);
      const frame = page.getByTestId('module-frame');
      const stage = (await frame.getAttribute('data-head')) === 'stage';
      if (stage) await expect(frame.getByTestId('module-signature'), `${path} @412`).toBeVisible();
      else await expect(frame.getByTestId('module-signature'), `${path} @412`).toHaveCount(0);
      // Empty slot targets are hidden by design; anything with content must stay.
      const hidden = await page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLElement>(
            '[data-testid="module-frame"] [data-signature], [data-testid="module-signature"] *, [data-testid="module-below"] *',
          ),
        ]
          .filter(
            (e) =>
              (e.childElementCount > 0 || (e.textContent ?? '').trim() !== '') &&
              getComputedStyle(e).display === 'none',
          )
          .map((e) => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]),
      );
      expect(hidden, `${path} @412: hidden parts of the signature`).toEqual([]);
      if (stage) {
        // On the stage the slot is as tall as its block, never a flex basis turned into height.
        const slotHeight = await frame.getByTestId('module-signature').evaluate((el) => {
          const own = el.getBoundingClientRect().height;
          const inner = Math.max(
            0,
            ...[...el.children].map((c) => c.getBoundingClientRect().height),
          );
          return { own, inner };
        });
        expect(
          slotHeight.own - slotHeight.inner,
          `${path} @412: the slot adds empty height around its block`,
        ).toBeLessThanOrEqual(16);
      }
    }
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
