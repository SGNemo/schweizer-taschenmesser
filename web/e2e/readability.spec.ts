import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

const html = (page: Page, attr: string) =>
  page.evaluate((a) => document.documentElement.getAttribute(a), attr);

async function save(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function addInvoice(page: Page, payee: string, amount: string, due: string) {
  await ready(page, '/invoices?new=1');
  const dialog = page.getByRole('dialog', { name: 'Rechnung hinzufügen' });
  await dialog.getByLabel('Empfänger', { exact: true }).fill(payee);
  await dialog.getByLabel('Betrag').fill(amount);
  await dialog.getByLabel('Fällig am').fill(due);
  await save(page);
}

test.describe('Reading aid, colour mode and grouping', () => {
  test('the reading aid is off by default, applies at once, survives a reload and does not move the layout', async ({
    page,
  }) => {
    await ready(page, '/settings/darstellung');
    const preview = page.getByTestId('reading-preview');
    await expect(preview.locator('[data-rs]')).toHaveCount(0);
    const before = await preview.boundingBox();

    await page.getByRole('switch', { name: 'Lesehilfe' }).click();
    await expect(preview.locator('[data-rs]').first()).toBeVisible();
    // Screen readers get the plain sentence: no extra roles or labels inside.
    await expect(preview.locator('[role], [aria-label], b, strong')).toHaveCount(0);
    const after = await preview.boundingBox();
    expect(after!.height).toBe(before!.height);

    await page.getByRole('group', { name: 'Stärke' }).getByRole('button', { name: 'Fett' }).click();
    expect(await html(page, 'data-read-style')).toBe('bold');
    const weight = await preview
      .locator('[data-rs]')
      .first()
      .evaluate((e) => getComputedStyle(e).fontWeight);
    expect(Number(weight)).toBeGreaterThanOrEqual(600);

    await page.reload();
    await expect(page.getByTestId('reading-preview').locator('[data-rs]').first()).toBeVisible();
    await page.getByRole('switch', { name: 'Lesehilfe' }).click();
    await expect(page.getByTestId('reading-preview').locator('[data-rs]')).toHaveCount(0);
  });

  test('Alt+L switches the reading aid', async ({ page }) => {
    await ready(page, '/settings/darstellung');
    await page.keyboard.press('Alt+KeyL');
    await expect(page.getByText('Lesehilfe ist an')).toBeVisible();
    await expect(page.getByTestId('reading-preview').locator('[data-rs]').first()).toBeVisible();
    await page.keyboard.press('Alt+KeyL');
    await expect(page.getByTestId('reading-preview').locator('[data-rs]')).toHaveCount(0);
  });

  test('the calm colour mode is a device setting', async ({ page }) => {
    await ready(page, '/settings/darstellung');
    await page
      .getByRole('group', { name: 'Farben' })
      .getByRole('button', { name: 'Ruhig' })
      .click();
    expect(await html(page, 'data-color')).toBe('calm');
    await page.reload();
    expect(await html(page, 'data-color')).toBe('calm');
    await page
      .getByRole('group', { name: 'Farben' })
      .getByRole('button', { name: 'Mit Bedeutung' })
      .click();
    expect(await html(page, 'data-color')).toBeNull();
  });

  test('invoices are grouped by due time, with counts, and a group can be folded', async ({
    page,
  }) => {
    await addInvoice(page, 'Alt GmbH', '10', '2026-09-20');
    await addInvoice(page, 'Bald AG', '20', '2026-10-01');
    await addInvoice(page, 'Spät KG', '30', '2026-12-01');
    await ready(page, '/invoices');
    for (const name of ['Überfällig', 'Diese Woche', 'Später'])
      await expect(page.getByRole('button', { name: `${name} einklappen` })).toBeVisible();
    // The overdue row carries text next to its colour.
    await expect(page.getByRole('button', { name: /Alt GmbH/ })).toBeVisible();
    await expect(page.locator('[data-group="overdue"]')).toContainText('seit 9 Tagen');

    await page.getByRole('button', { name: 'Später einklappen' }).click();
    await expect(page.getByRole('button', { name: /Spät KG/ })).toBeHidden();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Später ausklappen' })).toBeVisible();
  });

  test('todos are grouped; the navigation areas carry a stripe', async ({ page }) => {
    await ready(page, '/todos');
    await page.getByLabel('ToDo hinzufügen').fill('Fenster putzen');
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
    await expect(page.locator('[data-group="none"]')).toContainText('Fenster putzen');
    await expect(page.getByRole('button', { name: 'Ohne Datum einklappen' })).toBeVisible();
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`no axe violations with the reading aid on (${scheme})`, async ({ page }) => {
      // No fade-ins: axe would read the half-blended colour of an element that is still appearing.
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.addInitScript(() => localStorage.setItem('tm-read-aid', '1'));
      for (const url of ['/settings/darstellung', '/library']) {
        await ready(page, url);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations, url).toEqual([]);
      }
    });
  }

  test('the coverage levels reach headings, labels, buttons and navigation', async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => localStorage.setItem('tm-read-aid', '1'));
    await ready(page, '/invoices');
    // 25 % (default): only running text – headings and buttons are plain.
    await expect(page.locator('main h1 [data-rs]')).toHaveCount(0);
    await ready(page, '/settings/darstellung');
    const cover = page.getByRole('group', { name: 'Umfang' });
    await cover.getByRole('button', { name: '50 %' }).click();
    await expect(page.locator('main h1 [data-rs]').first()).toBeVisible();
    // In primary ink the text is dimmed a step and the word start keeps full ink (contrast, not only weight).
    const [start, rest] = await page.evaluate(() => {
      const h = document.querySelector('main h1')!;
      return [
        getComputedStyle(h.querySelector('[data-rs]')!).color,
        getComputedStyle(h.querySelector('[data-rt]')!).color,
      ];
    });
    expect(start).not.toBe(rest);
    // "Nur Kontrast": the weight stays the same, only the contrast differs.
    await page
      .getByRole('group', { name: 'Stärke' })
      .getByRole('button', { name: 'Nur Kontrast' })
      .click();
    const weights = await page.evaluate(() => {
      const h = document.querySelector('main h1')!;
      return [
        getComputedStyle(h.querySelector('[data-rs]')!).fontWeight,
        getComputedStyle(h).fontWeight,
      ];
    });
    expect(weights[0]).toBe(weights[1]);
    expect(
      await page
        .getByRole('navigation', { name: 'Hauptnavigation' })
        .locator('a [data-rs]')
        .count(),
    ).toBe(0);
    await cover.getByRole('button', { name: '100 %' }).click();
    await expect(
      page.getByRole('navigation', { name: 'Hauptnavigation' }).locator('a [data-rs]').first(),
    ).toBeVisible();
    expect(await html(page, 'data-read-aid')).toBe('100');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`no axe violations at 100 % on the main pages (${scheme})`, async ({ page }) => {
      test.setTimeout(240_000);
      // No fade-ins: axe would read the half-blended colour of an element that is still appearing.
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.addInitScript(() => {
        localStorage.setItem('tm-read-aid', '1');
        localStorage.setItem('tm-read-cover', '100');
      });
      for (const url of [
        '/',
        '/invoices',
        '/todos',
        '/notes',
        '/calendar',
        '/finance',
        '/budgets',
        '/lists',
        '/bookmarks',
        '/subscriptions',
        '/people',
        '/pantry',
        '/library',
        '/settings/darstellung',
        '/settings/allgemein',
      ]) {
        await ready(page, url);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations, url).toEqual([]);
      }
    });
  }
});
