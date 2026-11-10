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
    const pageBox = main.querySelector('[data-testid="page"]')!.getBoundingClientRect();
    return {
      overflowX: doc.scrollWidth - doc.clientWidth,
      mainOverflowX: main.scrollWidth - main.clientWidth,
      pageWidth: pageBox.width,
      /** 1 rem in px: the root grows on big monitors (DESIGN-SPEC § 2). */
      rem: parseFloat(getComputedStyle(doc).fontSize),
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
      // todos and settings = wide (100 rem; settings: category list + a column from 44 rem that grows on big screens).
      await page.goto('/todos');
      await expect(page.locator('main h1')).toBeVisible();
      const wide = await metrics(page);
      expect(wide.pageWidth).toBeLessThanOrEqual(100 * wide.rem + 1);
      await page.goto('/settings');
      await expect(page.locator('main h1')).toBeVisible();
      const narrow = await metrics(page);
      expect(narrow.pageWidth).toBeLessThanOrEqual(100 * narrow.rem + 1);
    });

    test('the root size grows with the screen (16 px up to 1920 px, 20 px at 3440 px)', async ({
      page,
    }) => {
      await prepare(page);
      const { rem } = await metrics(page);
      expect(rem).toBeCloseTo(Math.min(20, Math.max(16, 16 + (vp.width - 1920) * 0.0026)), 0);
    });

    test('home: widgets of one size class in one row band are equally tall', async ({ page }) => {
      await prepare(page);
      await page.goto('/');
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.getByTestId(/^widget-/).first()).toBeVisible();
      const boxes = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('[data-testid^="widget-"]')].map((el) => ({
          top: Math.round(el.getBoundingClientRect().top + window.scrollY),
          height: Math.round(el.getBoundingClientRect().height),
          span: getComputedStyle(el).gridRowStart,
        })),
      );
      const seen = new Map<string, number>();
      for (const b of boxes) {
        const key = `${b.top}/${b.span}`;
        if (seen.has(key)) expect(b.height, `band ${key}`).toBe(seen.get(key));
        else seen.set(key, b.height);
      }
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

// Phone header (mobile header, task 04): area label and tabs in one line, the topbar folds away
// while reading, comes back on scrolling up / keyboard focus, and stays put with less motion.
test.describe('phone header', () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const header = (page: Page) => page.locator('header').first();
  const makeTall = (page: Page) =>
    page.evaluate(() => {
      document.getElementById('main')!.style.minHeight = '4000px';
    });
  const scrollTo = (page: Page, y: number) => page.evaluate((top) => window.scrollTo(0, top), y);

  // Identity 4.0, rule 2 and 3 (phone): title row, the one module row, tabs; ≤ 144 px in all; content on screen 1.
  test('the head is a title row, the module row and the tabs: one line each, ≤ 144 px, no control in the title row', async ({
    page,
  }) => {
    await prepare(page);
    await page.goto('/calendar');
    await expect(page.locator('main h1').first()).toBeVisible();
    const box = await page.getByTestId('module-frame').evaluate((head) => {
      const r = (el: Element | null) => el!.getBoundingClientRect();
      const row = head.querySelector('[data-testid="module-title-row"]');
      const modules = head.querySelector('nav[data-module-row]');
      const tabs = head.querySelector('[data-slot="tabs"]');
      const h1 = head.querySelector('h1');
      return {
        height: r(head).height,
        headBottom: r(head).bottom,
        eyebrowMid: (r(head.querySelector('p')).top + r(head.querySelector('p')).bottom) / 2,
        h1Top: r(h1).top,
        h1Bottom: r(h1).bottom,
        rowBottom: r(row).bottom,
        modulesTop: r(modules).top,
        modulesBottom: r(modules).bottom,
        tabsTop: r(tabs).top,
        pillHeights: [...modules!.querySelectorAll('a')].map((a) => r(a).height),
        // The row scrolls sideways on a phone (it never wraps to a second line).
        pillTops: new Set([...modules!.querySelectorAll('a')].map((a) => Math.round(r(a).top)))
          .size,
        controls: row!.querySelectorAll('button, a[href]').length,
        mainTop: r(document.querySelector('main')).top,
        firstContentTop: r(document.querySelector('main [data-testid="page"]')).top,
      };
    });
    expect(box.height).toBeLessThanOrEqual(144);
    for (const h of box.pillHeights) expect(h).toBeGreaterThanOrEqual(44);
    expect(box.pillTops).toBe(1);
    // Three rows in this order, none overlapping: title row, module row, tabs.
    expect(box.h1Bottom).toBeLessThanOrEqual(box.rowBottom + 1);
    expect(box.modulesTop).toBeGreaterThanOrEqual(box.rowBottom - 1);
    expect(box.tabsTop).toBeGreaterThanOrEqual(box.modulesBottom - 1);
    // The eyebrow sits above the title, in the same block.
    expect(box.eyebrowMid).toBeLessThan(box.h1Top);
    // Rule 4: no button and no link in the phone's title row (the plus in the bottom bar is the entry).
    expect(box.controls).toBe(0);
    // The head starts at the top of the page and the content follows on the first screen (≤ 240 here; PACKAGES leaves y ≤ 220 to the area packages).
    expect(box.h1Top - box.mainTop).toBeLessThan(60);
    expect(box.firstContentTop).toBeLessThanOrEqual(240);
  });

  // Successor of U24 (the stacked `fokus` head): every standard head has the same title row on the phone – plate,
  // title and the one figure on one line, the figure at the right edge, nothing wraps under the title.
  test('title rows are alike on every module: plate, title and figure on one line', async ({
    page,
  }) => {
    await prepare(page);
    const rows: Record<string, number> = {};
    for (const path of ['/people', '/invoices', '/todos']) {
      await page.goto(path);
      await expect(page.locator('main h1').first()).toBeVisible();
      const box = await page.getByTestId('module-frame').evaluate((frame) => {
        const r = (el: Element | null | undefined) => {
          const b = el?.getBoundingClientRect();
          return b && b.width > 0
            ? { left: b.left, right: b.right, top: b.top, bottom: b.bottom }
            : null;
        };
        const row = frame.querySelector('[data-testid="module-title-row"]');
        return {
          head: frame.getAttribute('data-head'),
          row: r(row),
          plate: r(row?.querySelector('[aria-hidden="true"]')),
          title: r(frame.querySelector('h1')),
          figure: r(frame.querySelector('[data-testid="module-figure"]')),
          // The signature mark is no part of a standard head any more.
          mark: r(frame.querySelector('[data-testid="module-signature"]')),
        };
      });
      expect(box.head, path).toBe('standard');
      expect(box.title, path).not.toBeNull();
      expect(box.plate, path).not.toBeNull();
      expect(box.mark, path).toBeNull();
      // Plate left of the title, both inside the one row.
      expect(box.plate!.right, path).toBeLessThanOrEqual(box.title!.left);
      expect(box.title!.top, path).toBeGreaterThanOrEqual(box.row!.top - 1);
      expect(box.title!.bottom, path).toBeLessThanOrEqual(box.row!.bottom + 1);
      if (box.figure) {
        // Beside the title, never under it.
        expect(box.figure.left, path).toBeGreaterThanOrEqual(box.title!.right - 1);
        expect(box.figure.bottom, path).toBeLessThanOrEqual(box.row!.bottom + 1);
      }
      rows[path] = Math.round(box.row!.bottom - box.row!.top);
    }
    // One row height for every module.
    expect(new Set(Object.values(rows)).size, JSON.stringify(rows)).toBe(1);
  });

  test('scrolled, the title row and the module row slide away and the tabs stay under the top bar', async ({
    page,
  }) => {
    await prepare(page);
    await page.goto('/calendar');
    await expect(page.locator('main h1').first()).toBeVisible();
    await makeTall(page);
    await scrollTo(page, 150);
    await scrollTo(page, 600);
    const at = await page.getByTestId('module-frame').evaluate((head) => {
      const tabs = head.querySelector('[data-slot="tabs"]')!.getBoundingClientRect();
      const h1 = head.querySelector('h1')!.getBoundingClientRect();
      return { tabsTop: tabs.top, tabsBottom: tabs.bottom, h1Bottom: h1.bottom };
    });
    // The tabs are on screen, at the top; the title has left it.
    expect(at.tabsTop).toBeGreaterThanOrEqual(-1);
    expect(at.tabsBottom).toBeLessThanOrEqual(140);
    expect(at.h1Bottom).toBeLessThanOrEqual(at.tabsTop + 1);
    // No second bar repeats the title.
    await expect(page.getByTestId('module-compact')).toHaveCount(0);
  });

  test('the topbar folds away on scrolling down and returns on scrolling up', async ({ page }) => {
    await prepare(page);
    await page.goto('/calendar');
    await expect(page.locator('main h1').first()).toBeVisible();
    await makeTall(page);
    await expect(header(page)).not.toHaveAttribute('data-collapsed', 'true');
    await scrollTo(page, 150);
    await scrollTo(page, 300);
    await expect(header(page)).toHaveAttribute('data-collapsed', 'true');
    await scrollTo(page, 250);
    await expect(header(page)).not.toHaveAttribute('data-collapsed', 'true');
    await scrollTo(page, 600);
    await expect(header(page)).toHaveAttribute('data-collapsed', 'true');
    await scrollTo(page, 0);
    await expect(header(page)).not.toHaveAttribute('data-collapsed', 'true');
  });

  test('keyboard focus in the topbar brings it back; search stays reachable', async ({ page }) => {
    await prepare(page);
    await page.goto('/calendar');
    await expect(page.locator('main h1').first()).toBeVisible();
    await makeTall(page);
    await scrollTo(page, 200);
    await scrollTo(page, 500);
    await expect(header(page)).toHaveAttribute('data-collapsed', 'true');
    await header(page).getByRole('button', { name: /suche/i }).focus();
    await expect(header(page)).not.toHaveAttribute('data-collapsed', 'true');
  });

  test('an open dialog keeps the topbar out of the way of folding', async ({ page }) => {
    await prepare(page);
    await page.goto('/calendar');
    await expect(page.locator('main h1').first()).toBeVisible();
    await makeTall(page);
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog')).toBeVisible();
    await scrollTo(page, 200);
    await scrollTo(page, 500);
    await expect(header(page)).not.toHaveAttribute('data-collapsed', 'true');
  });

  test.describe('with less motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('the topbar stays fixed', async ({ page }) => {
      await prepare(page);
      await page.goto('/calendar');
      await expect(page.locator('main h1').first()).toBeVisible();
      await makeTall(page);
      await scrollTo(page, 200);
      await scrollTo(page, 500);
      await page.waitForTimeout(300);
      await expect(header(page)).not.toHaveAttribute('data-collapsed', 'true');
    });
  });
});

test.describe('desktop header', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test('the topbar does not fold while the content scrolls', async ({ page }) => {
    await prepare(page);
    await page.goto('/calendar');
    await expect(page.locator('main h1').first()).toBeVisible();
    await page.evaluate(() => {
      const main = document.getElementById('main')!;
      main.style.minHeight = '4000px';
      main.scrollTop = 200;
      main.scrollTop = 500;
    });
    await page.waitForTimeout(300);
    await expect(page.locator('header').first()).not.toHaveAttribute('data-collapsed', 'true');
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('main [data-testid="page"]')!.style.minHeight = '4000px';
      document.getElementById('main')!.scrollTop = 500;
    });
    // Identity 4.0: the head stays at the top of the content area while it scrolls (sticky), the eyebrow above the
    // row of the tabs, and the content has moved under it.
    const at = await page.getByTestId('module-frame').evaluate((head) => {
      const main = document.getElementById('main')!.getBoundingClientRect();
      const box = head.getBoundingClientRect();
      const label = head.querySelector('p')!.getBoundingClientRect();
      const tabs = head.querySelector('[data-slot="tabs"]')!.getBoundingClientRect();
      return {
        headTop: box.top - main.top,
        height: box.height,
        stacked: tabs.top >= label.bottom - 1,
        scrolled: document.getElementById('main')!.scrollTop,
      };
    });
    expect(at.scrolled).toBeGreaterThan(120);
    expect(Math.abs(at.headTop)).toBeLessThanOrEqual(1);
    expect(at.height).toBeLessThanOrEqual(120);
    expect(at.stacked).toBe(true);
  });
});

// U01 (UI round 6): the head band, the title row and the figure's room are there in the first paint, so nothing below
// the band moves when the module's chunk and its data arrive.
test.describe('no layout shift on load', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  /** Records the top of the page under the head on every frame (one entry per change) and the layout-shift total. */
  const watchShifts = (page: Page) =>
    page.addInitScript(`
      window.__u01 = { tops: [], cls: 0 };
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) if (!e.hadRecentInput) window.__u01.cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      } catch {}
      let frames = 0;
      const sample = () => {
        const el = document.querySelector('main [data-testid="page"]');
        if (el) {
          const top = Math.round(el.getBoundingClientRect().top);
          const tops = window.__u01.tops;
          if (tops[tops.length - 1] !== top) tops.push(top);
        }
        if (++frames < 600) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    `);

  async function visit(page: Page, path: string) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    // Watch a window longer than the frame's hold (1 s): stability over time cannot be polled for.
    await page.waitForTimeout(1500);
    const { tops, cls } = await page.evaluate(
      () => (window as unknown as { __u01: { tops: number[]; cls: number } }).__u01,
    );
    expect(tops, `${path}: top of the page under the head, one value per change`).toHaveLength(1);
    expect(cls, `${path}: layout-shift total`).toBeLessThan(0.05);
  }

  test('the page under the module head keeps its place from the first paint', async ({ page }) => {
    await prepare(page);
    // One open invoice, so the head shows its figure (the open sum) – the case that used to push the page down.
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open('taschenmesser');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction('invoices_invoice', 'readwrite');
            tx.objectStore('invoices_invoice').put({
              id: 'inv1',
              payee: 'Stadtwerke',
              amountMinor: 4200,
              dueDate: '2026-10-05',
              status: 'open',
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
            tx.onerror = () => reject(tx.error);
          };
        }),
    );
    await watchShifts(page);
    await visit(page, '/invoices');
  });

  test('a module without a figure keeps its place on the next visit', async ({ page }) => {
    await prepare(page);
    await page.goto('/people');
    await expect(page.locator('main h1')).toBeVisible();
    // Identity 4.0: a standard head has one row height whatever is in it, so nothing is remembered between visits.
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => localStorage.getItem('tm-head-room:/people@wide'))).toBeNull();
    await watchShifts(page);
    await visit(page, '/people');
  });
});
