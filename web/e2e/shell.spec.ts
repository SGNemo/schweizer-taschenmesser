import { expect, test } from '@playwright/test';
import {
  enable,
  mainNav,
  openNavArea,
  ready,
  openAppearanceGroup,
  openFoldedGroup,
} from './helpers';

test.describe('shell: sidebar, areas, favourites (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'sidebar is a desktop feature');

  test('favourites above the areas; the pin adds one, keeps it after a reload, and stops at five', async ({
    page,
  }) => {
    await enable(page, 'notes');
    await ready(page, '/');
    const nav = mainNav(page);
    await expect(nav.getByRole('heading', { name: 'Favoriten' })).toBeVisible();
    // F06: on the overview every area is folded; open the two this test uses (kept after a reload).
    await openNavArea(page, 'Geld');
    await openNavArea(page, 'Wissen');

    const add = (name: string) =>
      nav.getByRole('button', { name: `${name} zu den Favoriten hinzufügen` }).first();
    await add('Rechnungen').click();
    await expect(
      nav.getByRole('button', { name: 'Rechnungen aus den Favoriten entfernen' }).first(),
    ).toBeVisible();

    await page.reload();
    await expect(
      nav.getByRole('button', { name: 'Rechnungen aus den Favoriten entfernen' }).first(),
    ).toBeVisible();

    await add('Abos').click();
    await expect(
      nav.getByRole('button', { name: 'Abos aus den Favoriten entfernen' }).first(),
    ).toBeVisible();
    // Kalender, ToDos, Finanzen, Rechnungen, Abos = five
    await add('Notizen').click();
    await expect(page.getByText('Es sind höchstens 5 Favoriten möglich.')).toBeVisible();
    await expect(add('Notizen')).toBeVisible();
  });

  test('an area can be folded and the choice survives a reload', async ({ page }) => {
    // F06: the overview folds every area; a page unfolds its own.
    await ready(page, '/');
    await expect(
      mainNav(page).getByRole('button', { name: 'Planen auf- oder zuklappen' }),
    ).toHaveAttribute('aria-expanded', 'false');
    await ready(page, '/todos');
    const nav = mainNav(page);
    // ToDos is also a favourite, so look inside the area.
    const inArea = nav.locator('#area-plan').getByRole('link', { name: 'ToDos' });
    await expect(inArea).toBeVisible();
    await nav.getByRole('button', { name: 'Planen auf- oder zuklappen' }).click();
    await expect(inArea).toHaveCount(0);
    await page.reload();
    await expect(inArea).toHaveCount(0);
  });

  test('an area page opens the module last used there', async ({ page }) => {
    await ready(page, '/geld');
    await expect(page).toHaveURL(/\/finance$/);
    await ready(page, '/invoices');
    await ready(page, '/geld');
    await expect(page).toHaveURL(/\/invoices$/);
  });

  test('navigation in one level: no sub-navigation under the head, the sidebar switches the modules of an area', async ({
    page,
  }) => {
    await ready(page, '/finance');
    // Identity 4.0, rule 3: the row of area modules under the head is gone on the desktop.
    await expect(page.getByRole('navigation', { name: 'Geld: Module' })).toHaveCount(0);
    await expect(page.getByTestId('subnav')).toHaveCount(0);
    // The sidebar is the one place that lists them: the open area shows its modules, the current one marked.
    const nav = mainNav(page);
    await expect(nav.getByRole('link', { name: 'Finanzen', exact: true }).last()).toHaveAttribute(
      'aria-current',
      'page',
    );
    await nav.getByRole('link', { name: 'Rechnungen', exact: true }).last().click();
    await expect(page).toHaveURL(/\/invoices$/);
    await expect(nav.getByRole('link', { name: 'Rechnungen', exact: true }).last()).toHaveAttribute(
      'aria-current',
      'page',
    );
    // The head names the area in its eyebrow and holds the page's one h1.
    const head = page.getByTestId('module-frame');
    await expect(head.getByTestId('module-eyebrow')).toHaveText('Geld');
    await expect(head.getByRole('heading', { level: 1 })).toHaveText('Rechnungen');
  });

  test('one neutral "Neu" in the top bar opens quick capture; there is no FAB and no plus on the desktop', async ({
    page,
  }) => {
    await ready(page, '/');
    await expect(page.getByRole('button', { name: /Neu/ })).toBeVisible();
    const create = page.getByRole('button', { name: 'Neu: schnell hinzufügen' });
    // Identity 4.0, rule 4: "Neu" is neutral; the filled accent belongs to the module's action in the head.
    await expect(create).toHaveAttribute('data-variant', 'secondary');
    await create.click();
    await expect(page.getByRole('textbox', { name: 'Was möchtest du festhalten?' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Schnell hinzufügen', exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByTestId('bottom-plus')).toBeHidden();
  });

  test('the sidebar can be switched to the rail in the settings and back with the handle', async ({
    page,
  }) => {
    await ready(page, '/settings/darstellung');
    await openAppearanceGroup(page, 'other');
    await page
      .getByRole('group', { name: 'Seitenleiste' })
      .getByRole('button', { name: 'Schmal' })
      .click();
    const nav = mainNav(page);
    await expect(nav.getByRole('heading', { name: 'Favoriten' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Geld' })).toHaveAttribute('href', '/geld');
    await page.getByRole('button', { name: 'Seitenleiste ausklappen' }).click();
    await expect(nav.getByRole('heading', { name: 'Favoriten' })).toBeVisible();
  });

  test('below 1200 px the rail is automatic and shows the areas as icons with tooltips', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await ready(page, '/');
    const nav = mainNav(page);
    await expect(nav.getByRole('link', { name: 'Planen' })).toBeVisible();
    await expect(nav.getByRole('heading', { name: 'Favoriten' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Seitenleiste ausklappen' })).toHaveCount(0);
    await nav.getByRole('link', { name: 'Geld' }).click();
    await expect(page).toHaveURL(/\/finance$/);
  });

  test('favourites can also be set in the settings (touch path)', async ({ page }) => {
    await ready(page, '/settings/darstellung');
    await openFoldedGroup(page, 'favourites', 'list');
    const row = page.getByRole('switch', { name: 'Abos' });
    await expect(row).toHaveAttribute('aria-checked', 'false');
    await row.click();
    await expect(row).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('shell: phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'bottom navigation is a phone feature');

  test('bottom navigation: Übersicht · area 1 · plus · area 2 · Mehr; the plus captures, no FAB, no "Neu" in the top bar', async ({
    page,
  }) => {
    await ready(page, '/');
    const nav = mainNav(page);
    await expect(nav.getByRole('link', { name: 'Übersicht' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Planen' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Geld' })).toBeVisible();
    // Five targets, the plus in the middle (Identity 4.0, rule 3).
    await expect(nav.locator(':scope > *')).toHaveCount(5);
    await expect(nav.locator(':scope > *').nth(2)).toHaveAttribute('data-testid', 'bottom-plus');
    // On the overview the plus is the quick capture; its name contains its visible text (WCAG 2.5.3).
    const plus = nav.getByRole('button', { name: 'Neu eintragen', exact: true });
    await expect(plus).toBeVisible();
    await expect(plus).toHaveText('Neu');
    await expect(page.getByRole('button', { name: 'Schnell hinzufügen', exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByRole('button', { name: 'Neu: schnell hinzufügen' })).toBeHidden();
    await plus.click();
    await expect(page.getByRole('dialog', { name: 'Schnell hinzufügen' })).toBeVisible();
    await page.keyboard.press('Escape');

    await nav.getByRole('link', { name: 'Geld' }).click();
    await expect(page).toHaveURL(/\/finance$/);
    await expect(nav.getByRole('link', { name: 'Geld' })).toHaveAttribute('aria-current', 'page');
    // On a module page the plus is the module's action, named after the thing it adds.
    const add = nav.getByRole('button', { name: 'Buchung eintragen', exact: true });
    await expect(add).toHaveText('Buchung');
    // The head of the phone holds no control: the plus is the one entry.
    const row = page.getByTestId('module-title-row');
    await expect(row.getByRole('button')).toHaveCount(0);
    await expect(row.getByRole('link')).toHaveCount(0);
  });

  test('phone: the modules of an area are the one module row in the head; the tabs stay at hand when scrolled', async ({
    page,
  }) => {
    await ready(page, '/finance');
    const head = page.getByTestId('module-frame');
    const row = head.getByRole('navigation', { name: 'Geld: Module' });
    await expect(row.getByRole('link', { name: 'Finanzen' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await row.getByRole('link', { name: 'Rechnungen' }).click();
    await expect(page).toHaveURL(/\/invoices$/);
    await expect(
      page
        .getByTestId('module-frame')
        .getByRole('navigation', { name: 'Geld: Module' })
        .getByRole('link', { name: 'Rechnungen' }),
    ).toHaveAttribute('aria-current', 'page');
    // No second bar that repeats the title: the head is the one thing at the top.
    await expect(page.getByTestId('module-compact')).toHaveCount(0);
  });

  test('"Mehr" reaches tools, library and settings', async ({ page }) => {
    await ready(page, '/');
    await mainNav(page).getByRole('button', { name: 'Mehr' }).click();
    const sheet = page.getByRole('dialog', { name: 'Mehr' });
    await expect(sheet.getByRole('button', { name: 'Werkzeuge' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Modul-Bibliothek' })).toBeVisible();
    await sheet.getByRole('link', { name: 'Einstellungen' }).click();
    await expect(page).toHaveURL(/\/settings(\/allgemein)?$/);
  });
});

test.describe('shell: the plus never covers the end of a page (G17, phone 390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('scrolled to the end, the last day of the planner board ends above the plus', async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date('2026-11-09T10:00:00'));
    await page.goto('/');
    await expect(page.locator('main h1')).toBeVisible();
    // Switch on the ToDos and the planner like the library would (raw write into the module table).
    await page.evaluate(
      (ids) =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open('taschenmesser');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction('_modules', 'readwrite');
            for (const id of ids)
              tx.objectStore('_modules').put({
                id,
                enabled: true,
                dataPolicy: null,
                createdAt: 1,
                updatedAt: 1,
                deviceId: 'e2e',
                deletedAt: null,
                _f: {},
              });
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
          };
        }),
      ['todos', 'planner'],
    );
    await ready(page, '/planner');
    const field = page.getByLabel('Eintragen oder sagen', { exact: true });
    for (const text of ['Steuer 30min', 'Keller 30min', 'Blogpost 30min', 'Anrufen 20min']) {
      await field.fill(text);
      await field.press('Enter');
      await expect(field).toHaveValue('');
    }
    // Identity 4.0: no floating button any more; the plus sits in the bottom bar and rises a little above it.
    await expect(page.getByRole('button', { name: 'Schnell hinzufügen', exact: true })).toHaveCount(
      0,
    );
    const fab = page.getByTestId('bottom-plus');
    await expect(fab).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    // The lowest content of the page (inside <main>) against the top of the plus.
    const contentBottom = await page.evaluate(() =>
      Math.max(
        ...[...document.querySelectorAll('main *')]
          .map((e) => e.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.height > 0)
          .map((r) => r.bottom),
      ),
    );
    const fabBox = (await fab.boundingBox())!;
    expect(contentBottom).toBeLessThanOrEqual(fabBox.y);
  });
});
