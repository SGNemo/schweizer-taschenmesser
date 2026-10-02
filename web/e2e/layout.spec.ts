import { expect, test, type Page } from '@playwright/test';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

// Desktop sizes, ultrawide, half-screen snapping, tablet, phone and a small window.
const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3440, height: 1440 },
  { width: 960, height: 1040 },
  { width: 820, height: 1180 },
  { width: 700, height: 600 },
  { width: 412, height: 915 },
];

const MODULES = [
  'calendar',
  'todos',
  'reminders',
  'finance',
  'invoices',
  'subscriptions',
  'bookmarks',
  'notes',
  'lists',
  'budgets',
  'vault',
  'accounts',
  'pantry',
  'people',
];
const PAGES = ['/', ...MODULES.map((m) => `/${m}`), '/library', '/tools', '/settings'];

/** Enables every module and adds a few calendar events, straight into IndexedDB. */
async function prepare(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    (ids) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const env = { createdAt: 1, updatedAt: 1, deviceId: 'e2e', deletedAt: null, _f: {} };
          const tx = db.transaction(['_modules', 'calendar_event'], 'readwrite');
          for (const id of ids)
            tx.objectStore('_modules').put({ id, enabled: true, dataPolicy: null, ...env });
          for (const [i, day] of ['2026-09-29', '2026-09-29', '2026-09-30', '2026-10-02'].entries())
            tx.objectStore('calendar_event').put({
              id: `e${i}`,
              title: `Beispieltermin ${i}`,
              allDay: false,
              startDate: day,
              startTime: `${9 + i}:00`.padStart(5, '0'),
              ...env,
            });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    MODULES,
  );
}

async function metrics(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const main = document.querySelector('main')!;
    const pageBox = main.firstElementChild!.getBoundingClientRect();
    return {
      overflowX: doc.scrollWidth - doc.clientWidth,
      mainOverflowX: main.scrollWidth - main.clientWidth,
      pageWidth: pageBox.width,
    };
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test('every page fits the window and shows its content', async ({ page }) => {
      await prepare(page);
      for (const path of PAGES) {
        await page.goto(path);
        await expect(page.locator('main h1').first(), path).toBeVisible();
        const m = await metrics(page);
        expect(m.overflowX, `${path}: horizontal page overflow`).toBeLessThanOrEqual(0);
        expect(m.mainOverflowX, `${path}: horizontal content overflow`).toBeLessThanOrEqual(0);
      }
    });

    test('the page container honours its variant', async ({ page }) => {
      await prepare(page);
      // todos = wide (100rem = 1600 px), settings = narrow (45rem = 720 px).
      await page.goto('/todos');
      await expect(page.locator('main h1')).toBeVisible();
      expect((await metrics(page)).pageWidth).toBeLessThanOrEqual(1601);
      await page.goto('/settings');
      await expect(page.locator('main h1')).toBeVisible();
      expect((await metrics(page)).pageWidth).toBeLessThanOrEqual(721);
    });

    test('the calendar month grid uses the available height and width', async ({ page }) => {
      await prepare(page);
      await page.goto('/calendar?view=month&date=2026-09-29');
      const table = page.locator('main table');
      await expect(table).toBeVisible();
      const box = await table.boundingBox();
      const main = await page.locator('main').boundingBox();
      expect(box).not.toBeNull();
      if (vp.width >= 900) {
        // Desktop: at least the minimum grid height, and it reaches the bottom of the content area
        // whenever the window is tall enough to show more than the minimum.
        expect(box!.height).toBeGreaterThanOrEqual(34 * 16 - 1);
        if (vp.height >= 900) {
          expect(main!.y + main!.height - (box!.y + box!.height)).toBeLessThan(64);
        }
      }
      if (vp.width >= 1920) {
        // `full` layout: not limited to a centred column (the agenda panel takes ~30 rem of it).
        expect(box!.width).toBeGreaterThan(1000);
      }
    });
  });
}

test.describe('wide screens (1920x1080)', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('week and day show an hour grid, the agenda sits next to it', async ({ page }) => {
    await prepare(page);
    await page.goto('/calendar?view=week&date=2026-09-29');
    const grid = page.getByRole('group', { name: 'Zeitraster' });
    await expect(grid).toBeVisible();
    await expect(grid.getByRole('heading', { level: 3 })).toHaveCount(7);
    await expect(grid.getByRole('button', { name: /Beispieltermin 0/ })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Agenda' })).toBeVisible();
    await page.goto('/calendar?view=day&date=2026-09-29');
    await expect(page.getByRole('group', { name: 'Zeitraster' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Zeitraster' }).getByRole('heading')).toHaveCount(
      1,
    );
  });

  test('the hour grid scrolls to the current time', async ({ page }) => {
    await prepare(page);
    await page.goto('/calendar?view=day&date=2026-09-29');
    const body = page.getByRole('group', { name: 'Zeitraster' }).locator('div[class*="tgBody"]');
    await expect(body).toBeVisible();
    // "now" is 10:00 (fixed clock); the grid starts 1.5 h earlier, so it is scrolled down.
    await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(200);
  });

  test('accounts: the selected entry opens in a side panel instead of a dialog', async ({
    page,
  }) => {
    await prepare(page);
    await page.goto('/accounts');
    await page.getByLabel('Master-Passwort', { exact: true }).fill('Demo-Master-Passwort-1'); // gitleaks:allow
    await page.getByLabel('Master-Passwort wiederholen').fill('Demo-Master-Passwort-1'); // gitleaks:allow
    await page.getByRole('button', { name: 'Tresor erstellen' }).click();
    await page.getByRole('button', { name: 'Zugang hinzufügen' }).click({ timeout: 30_000 });
    const form = page.getByRole('dialog', { name: 'Zugang hinzufügen' });
    await form.getByLabel('Name', { exact: true }).fill('Demo-Shop example.org');
    await form.getByLabel('Passwort', { exact: true }).fill('demo-passwort-000'); // gitleaks:allow
    await form.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const panel = page.getByRole('complementary', { name: 'Details' });
    await expect(panel.getByRole('heading', { name: 'Demo-Shop example.org' })).toBeVisible();
    // The secret stays hidden until revealed, exactly as in the dialog.
    await expect(panel.getByText('demo-passwort-000')).toHaveCount(0);
    await page.getByRole('button', { name: 'Sperren' }).click();
    await expect(page.getByLabel('Master-Passwort')).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Details' })).toHaveCount(0);
  });
});
