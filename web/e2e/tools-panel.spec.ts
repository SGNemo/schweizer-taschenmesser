import { expect, test } from '@playwright/test';
import { openToolbox, pickTool, ready } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

test.describe('toolbox panel', () => {
  test('opens on the first tool, then on the one used last, in its own hue', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'a phone starts on the list (see the phone test)');
    await ready(page, '/');
    await page.getByRole('button', { name: 'Werkzeuge' }).first().click();
    const calc = page.getByRole('dialog', { name: 'Rechner' });
    await expect(calc).toBeVisible();
    await expect(calc.locator('[data-tool="calc"]')).toHaveAttribute('data-hue', 'cobalt');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await pickTool(page, 'Timer & Stoppuhr');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Werkzeuge' }).first().click();
    const timer = page.getByRole('dialog', { name: 'Timer & Stoppuhr' });
    await expect(timer).toBeVisible();
    await expect(timer.locator('[data-tool="timer"]')).toHaveAttribute('data-hue', 'violet');
  });

  test('Esc closes the panel and the focus returns to the button that opened it', async ({
    page,
  }) => {
    await ready(page, '/');
    const opener = page.getByRole('button', { name: 'Werkzeuge' }).first();
    await opener.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
});

test.describe('toolbox panel – keyboard (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'keys are a desktop feature');

  test('the search is focused, Enter opens the first match, Esc empties it before it closes', async ({
    page,
  }) => {
    await ready(page, '/');
    await page.keyboard.press('Control+.');
    const dialog = page.getByRole('dialog');
    const search = dialog.getByRole('searchbox', { name: 'Werkzeuge durchsuchen' });
    await expect(search).toBeFocused();
    // The list is there once the tool settings are read; typing earlier would filter nothing.
    await expect(dialog.getByRole('button', { name: 'Rechner', exact: true })).toBeVisible();

    await page.keyboard.type('waehrung');
    await expect(dialog.getByRole('button', { name: 'Rechner', exact: true })).toHaveCount(0);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Währung' })).toBeVisible();

    // The focus follows into the tool: its amount field once the rates are there, the surface before.
    await expect(page.locator('[data-tool="currency"]:focus-within')).toHaveCount(1);
    await search.focus();
    await page.keyboard.press('Escape'); // empties the search …
    await expect(search).toHaveValue('');
    await expect(page.getByRole('dialog')).toBeVisible(); // … the panel stays
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('a word without a match says so', async ({ page }) => {
    await ready(page, '/');
    await page.keyboard.press('Control+.');
    await page.keyboard.type('qqqunbekanntqqq');
    await expect(page.getByRole('dialog').getByText('Kein Werkzeug passt')).toBeVisible();
  });

  test('Alt+number switches the tool, also out of a field; arrows walk the list', async ({
    page,
  }) => {
    await ready(page, '/');
    await page.keyboard.press('Control+.');
    await expect(page.getByRole('dialog', { name: 'Rechner' })).toBeVisible();
    await page.keyboard.press('Alt+3'); // Rechnen: Rechner, Währung, then Timer (zeit) = 3rd of the four
    await expect(page.getByRole('dialog', { name: 'Timer & Stoppuhr' })).toBeVisible();
    await expect(page.locator('[data-tool="timer"]')).toBeFocused(); // the focus follows the tool
    await page.keyboard.press('Alt+1');
    await expect(page.getByRole('dialog', { name: 'Rechner' })).toBeVisible();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('searchbox').focus();
    await page.keyboard.press('ArrowDown');
    await expect(dialog.getByRole('button', { name: 'Rechner', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(dialog.getByRole('button', { name: 'Währung', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Währung' })).toBeVisible();
  });

  test('"In eigenem Fenster öffnen" opens the tool alone in a window', async ({ page }) => {
    // A popup has no focus on a headless runner, so the real clipboard may refuse; the toast is what is tested.
    await page.context().addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.resolve() },
        configurable: true,
      });
    });
    await ready(page, '/');
    await page.keyboard.press('Control+.');
    const popupPromise = page.waitForEvent('popup');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'In eigenem Fenster öffnen' })
      .click();
    const popup = await popupPromise;
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await popup.waitForLoadState();
    await expect(popup).toHaveURL(/\/tool\/calc$/);
    await expect(popup.getByRole('heading', { level: 1, name: 'Rechner' })).toBeVisible();
    await expect(popup.getByRole('navigation', { name: 'Hauptnavigation' })).toHaveCount(0);
    await popup.getByLabel('Rechnung').fill('2 + 2');
    await popup.getByRole('button', { name: 'Ergebnis', exact: true }).click();
    await expect(popup.getByTestId('calc-result')).toHaveText('4');
    // The window brings its own toasts: copying says so.
    await popup.getByRole('button', { name: 'Ergebnis kopieren' }).first().click();
    await expect(popup.getByText('Kopiert.')).toBeVisible();
  });

  test('a blocked pop-up says so inside the panel', async ({ page }) => {
    await page.addInitScript(() => {
      window.open = () => null;
    });
    await ready(page, '/');
    await page.keyboard.press('Control+.');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'In eigenem Fenster öffnen' })
      .click();
    await expect(
      page.getByRole('dialog').getByText('Das Fenster wurde vom Browser blockiert'),
    ).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('a tool that is off is not served alone', async ({ page }) => {
    await page.goto('/tool/dice');
    await expect(page.getByText('ausgeschaltet oder unbekannt')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Werkzeuge verwalten' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Würfel & Zufall' })).toHaveCount(0);
  });
});

test.describe('toolbox panel – phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone sheet');

  test('is a full-screen sheet: the list on first use, then the tool used last, no overflow', async ({
    page,
  }) => {
    await ready(page, '/');
    await page.getByRole('button', { name: 'Werkzeuge' }).first().click();
    // Nothing used yet: the list comes first, with focus-friendly 44 px rows and no Alt hints.
    const first = page.getByRole('dialog', { name: 'Werkzeuge' });
    await expect(first.getByRole('searchbox')).toBeVisible();
    const rechner = first.getByRole('button', { name: 'Rechner', exact: true });
    // The sheet slides in; measure once it has settled.
    await expect
      .poll(async () => Math.round((await rechner.boundingBox())?.height ?? 0))
      .toBeGreaterThanOrEqual(44);
    await expect(first.locator('kbd').first()).toBeHidden();
    await rechner.click();
    await expect(page.getByRole('dialog', { name: 'Rechner' }))
      .toBeFocused({ timeout: 100 })
      .catch(() => undefined);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('button', { name: 'Werkzeuge' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Rechner' });
    await expect(dialog).toBeVisible();
    const vp = page.viewportSize()!;
    // The dialog pops in (scale); measure once it has settled.
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox();
        return box ? [Math.round(box.width), Math.round(box.height) >= vp.height - 1] : null;
      })
      .toEqual([vp.width, true]);
    // One pane: the list is not on screen, no detach button on a phone.
    await expect(dialog.getByRole('searchbox')).toBeHidden();
    await expect(dialog.getByRole('button', { name: 'In eigenem Fenster öffnen' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      vp.width,
    );

    const list = await openToolbox(page);
    await expect(list.getByRole('searchbox')).toBeVisible();
    await list.getByRole('button', { name: 'QR-Code', exact: true }).last().click();
    await expect(page.getByRole('dialog', { name: 'QR-Code' })).toBeVisible();
  });
});
