import { expect, type Page } from '@playwright/test';
import { measurePage, surfaceMetrics } from '../../scripts/lib/stimulusBudget';
import { test } from './helpers';
import { DESKTOP, PHONE, startSeeded } from './guards';

/**
 * The overview after package 0b-7 of UI audit 2026-11 (Identity 4.0), measured on the seeded Dev-Preview with every
 * module on, in both views and both windows:
 * surfaces are tone steps (no shadow in `main`), few coloured things above the fold (detailed ≤ 20, calm ≤ 8), no
 * layout shift while the page loads (≤ 0.05), the greeting has the measure of a module page's title, the head's tools
 * are one row on the phone, the page is flush with the app frame, nothing stands on the page twice, "Jetzt wichtig"
 * folds everything that is neither overdue nor due today, red is for overdue and exceeded only, no title of a
 * document from the vault ever shows, and "Werte ausblenden" covers the amounts here too.
 */
const COLOURED_MAX = { all: 20, calm: 8 } as const;
const CLS_MAX = 0.05;
type View = keyof typeof COLOURED_MAX;

async function openOverview(page: Page, view: View, phone: boolean) {
  await page.addInitScript((v) => {
    localStorage.setItem('tm-home-view', v);
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as {
          value: number;
          hadRecentInput: boolean;
        }[])
          if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      // no layout-shift entries in this browser: the value stays 0
    }
  }, view);
  await startSeeded(page, { phone });
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await settled(page);
}

/** Lazy widgets and their data arrive at their own pace: waits until the page has stopped changing. */
async function settled(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  let last = '';
  for (let same = 0, i = 0; i < 40 && same < 4; i++) {
    await page.waitForTimeout(250);
    const now = await page.evaluate(() => {
      const main = document.querySelector('main')!;
      return `${main.querySelectorAll('*').length}/${main.scrollHeight}/${(main.textContent ?? '').length}`;
    });
    same = now === last ? same + 1 : 0;
    last = now;
  }
}

for (const [device, viewport] of [
  ['desktop', DESKTOP],
  ['phone', PHONE],
] as const) {
  const phone = device === 'phone';
  test.describe(`overview – ${device}`, () => {
    test.use({ viewport, seeded: { scale: 'medium', desktop: true, preview: true } });

    for (const view of ['all', 'calm'] as const) {
      test(`${view}: tone steps, little colour, no layout shift, the title's measure`, async ({
        page,
      }) => {
        await openOverview(page, view, phone);
        const surfaces = surfaceMetrics(await page.evaluate(measurePage));
        expect(surfaces.shadows, 'shadows in main (only floating things cast one)').toBe(0);
        expect(surfaces.colouredAboveFold, 'coloured things above the fold').toBeLessThanOrEqual(
          COLOURED_MAX[view],
        );
        const read = await page.evaluate(() => {
          const h1 = getComputedStyle(document.querySelector('main h1')!);
          return {
            cls: (window as unknown as { __cls: number }).__cls,
            h1: `${h1.fontSize}/${h1.fontWeight}`,
            sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          };
        });
        expect(read.cls, 'layout shift while loading').toBeLessThanOrEqual(CLS_MAX);
        expect(read.h1, 'greeting = title of a module page').toBe(phone ? '22px/600' : '28px/600');
        expect(read.sideways, 'no sideways scrolling').toBe(false);
      });

      test(`${view}: nothing stands on the page twice`, async ({ page }) => {
        await openOverview(page, view, phone);
        const read = await page.evaluate(() => {
          const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
          const all = (sel: string) => Array.from(document.querySelectorAll(sel));
          const strip = all('[data-testid="attention"] a').map((a) => ({
            label: text(a.querySelector('span > span > span:last-child') ?? a),
            tone: a.getAttribute('data-tone'),
            whole: text(a),
          }));
          // What the blocks list one by one: the agenda's entries of today and the "Heute" card's rows.
          const agendaToday = all('[data-testid="agenda-today"] a span:last-child').map(text);
          const card = all('[data-testid="today-appointments"] a').map(text);
          const until = text(document.querySelector('[data-testid="today-until"]') ?? document.body)
            .split(' · ')
            .slice(1)
            .join(' · ')
            .replace(/^\d\d:\d\d /, '');
          return {
            strip,
            agendaToday,
            card,
            until: document.querySelector('[data-testid="today-until"]') ? until : '',
            agenda: !!document.querySelector('[data-testid="agenda"]'),
            headWeather: all('[data-testid="overview-head"] a[href="/weather"]').length,
            weatherCards: all('[data-testid^="widget-weather:"]').length,
            fold: text(
              document.querySelector('[data-testid="attention-waiting"]') ?? document.body,
            ),
            folded: all('[data-testid="attention-waiting-list"] a').length,
          };
        });
        // The strip counts, the blocks list: no entry of the strip repeats a title a block lists.
        const listed = [...read.agendaToday, ...read.card, read.until].filter(Boolean);
        for (const entry of read.strip)
          expect(
            listed,
            `"${entry.whole}" is listed by a block and named by the strip`,
          ).not.toContain(entry.label);
        // No title twice as a list: the agenda and the "Heute" card never both list the day.
        expect(read.agenda && read.card.length > 0, 'agenda and the card both list today').toBe(
          false,
        );
        expect(new Set(read.card).size, 'a title twice on the "Heute" card').toBe(read.card.length);
        expect(read.card, 'the card repeats the appointment its first line names').not.toContain(
          read.until,
        );
        // The weather stands once: in the head or as a card.
        expect(
          read.headWeather + Math.min(read.weatherCards, 1),
          'weather in head and as a card',
        ).toBeLessThanOrEqual(1);
        // "Ruhig" = strip + "Heute" card: no agenda unless pinned; the detailed view shows it.
        expect(read.agenda).toBe(view === 'all');
        // Red is for overdue and exceeded only, and says so in words.
        for (const entry of read.strip.filter((e) => e.tone === 'danger'))
          expect(entry.whole).toMatch(/überfällig|überschritten/);
        // The folded line counts the entries behind it.
        expect(read.fold).toContain(`Kann warten · ${read.folded}`);
        expect(read.fold).toContain('nichts davon muss heute sein.');
      });
    }

    test('no title of a document from the vault on the overview, in either view', async ({
      page,
    }) => {
      await openOverview(page, 'all', phone);
      // Titles only the vault knows: a name that an invoice, a subscription or an appointment carries too may stand
      // on the overview through that module.
      const titles = await page.evaluate(
        () =>
          new Promise<string[]>((resolve, reject) => {
            const open = indexedDB.open('taschenmesser');
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const db = open.result;
              const stores = Array.from(db.objectStoreNames).filter((n) => !n.startsWith('_'));
              const tx = db.transaction(stores);
              const vault: string[] = [];
              const elsewhere = new Set<string>();
              for (const name of stores) {
                const all = tx.objectStore(name).getAll();
                all.onsuccess = () => {
                  for (const row of all.result as Record<string, unknown>[])
                    if (name === 'vault_document') vault.push(String(row.title ?? ''));
                    else
                      for (const value of Object.values(row))
                        if (typeof value === 'string') elsewhere.add(value);
                };
              }
              tx.oncomplete = () => {
                db.close();
                resolve(vault.filter((title) => title.length > 3 && !elsewhere.has(title)));
              };
              tx.onerror = () => reject(tx.error);
            };
          }),
      );
      // Everywhere the vault could reach: the head, "Jetzt wichtig", the agenda, its own cards and the "Heute"
      // card. The cards of other modules are left out: a subscription may be called like a contract.
      const shownIn = async () => {
        const text = await page.evaluate(() => {
          const main = document.querySelector('main')!.cloneNode(true) as HTMLElement;
          for (const card of main.querySelectorAll('[data-testid^="widget-"]')) {
            const id = card.getAttribute('data-testid')!;
            if (!id.startsWith('widget-vault:') && id !== 'widget-todos:next') card.remove();
          }
          return main.textContent ?? '';
        });
        return titles.filter((title) => text.includes(title));
      };
      expect(await shownIn(), 'detailed').toEqual([]);
      // Also with the folded entries opened.
      await page.getByTestId('attention-waiting').click();
      expect(await shownIn(), 'detailed, "Kann warten" opened').toEqual([]);
      await page
        .getByRole('group', { name: 'Übersicht' })
        .getByRole('button', { name: 'Ruhig' })
        .click();
      await expect(page.getByTestId('agenda')).toHaveCount(0);
      expect(await shownIn(), 'calm').toEqual([]);
    });

    test('"Werte ausblenden" covers the amounts of the overview too', async ({ page }) => {
      await openOverview(page, 'all', phone);
      const amount = /\d[\d.]*,\d{2}\s?€/;
      await expect(page.getByTestId('widget-finance:balance')).toContainText(amount);
      await page.evaluate(
        () =>
          new Promise<void>((resolve, reject) => {
            const open = indexedDB.open('taschenmesser');
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const tx = open.result.transaction('_meta', 'readwrite');
              tx.objectStore('_meta').put({ key: 'focus.hideValues', value: true });
              tx.oncomplete = () => {
                open.result.close();
                resolve();
              };
              tx.onerror = () => reject(tx.error);
            };
          }),
      );
      await page.reload();
      await expect(page.getByTestId('widget-finance:balance')).toBeVisible();
      await expect(page.getByTestId('widget-finance:balance')).not.toContainText(amount);
      await expect(page.getByTestId('widget-finance:month')).not.toContainText(amount);
      // Amounts inside a line (a card's context, an invoice's entry "Stadtwerke · 87,40 €") become dots too.
      for (const block of ['attention', 'agenda'])
        await expect(page.getByTestId(block)).not.toContainText(amount);
      await page
        .getByRole('group', { name: 'Übersicht' })
        .getByRole('button', { name: 'Ruhig' })
        .click();
      await expect(page.getByTestId('widget-todos:next')).toBeVisible();
      await expect(page.getByTestId('widget-todos:next')).not.toContainText(amount);
      await expect(page.getByTestId('attention')).not.toContainText(amount);
    });
  });
}

test.describe('overview – build-up under load', () => {
  test.use({ viewport: DESKTOP, seeded: { scale: 'medium', desktop: true, preview: true } });

  // The guard above runs at full speed, where a page has its data before anything paints. With the CPU slowed down
  // the cards arrive one after the other: "Ausführlich" on a wide window, with the most cards, shows whether they
  // build up without pushing anything (decision "Overview builds up in grid order"). Both visits: after a reload and
  // coming back.
  test('desktop "Ausführlich", CPU 4×: the cards build up without a layout shift', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      localStorage.setItem('tm-home-view', 'all');
      const w = window as unknown as { __cls: number; __armed: boolean };
      w.__cls = 0;
      w.__armed = false;
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as {
            value: number;
            hadRecentInput: boolean;
          }[])
            if (w.__armed && !e.hadRecentInput) w.__cls += e.value;
        }).observe({ type: 'layout-shift' });
      } catch {
        // no layout-shift entries in this browser: the value stays 0
      }
    });
    await startSeeded(page, { phone: false });
    const cdp = await page.context().newCDPSession(page);
    const visit = async (reload: boolean) => {
      if (reload) await page.goto('/todos');
      else
        await page.evaluate(() => {
          history.pushState({}, '', '/todos');
          dispatchEvent(new PopStateEvent('popstate'));
        });
      await expect(page.locator('main h1')).toBeVisible();
      await settled(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.evaluate(() => {
        const w = window as unknown as { __cls: number; __armed: boolean };
        w.__cls = 0;
        w.__armed = true;
        history.pushState({}, '', '/');
        dispatchEvent(new PopStateEvent('popstate'));
      });
      // Built up: the grid has its cards, none waits and the grid no longer settles.
      const grid = page.getByTestId('home-grid');
      await expect(grid.locator('> [data-testid^="widget-"]').first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(grid.locator('> [data-wait]')).toHaveCount(0, { timeout: 30_000 });
      await expect(grid).not.toHaveAttribute('data-settling', /.*/, { timeout: 30_000 });
      await settled(page);
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      return cls;
    };
    expect(await visit(true), 'layout shift, first visit').toBeLessThanOrEqual(CLS_MAX);
    expect(await visit(false), 'layout shift, coming back').toBeLessThanOrEqual(CLS_MAX);
  });
});

test.describe('overview – head and frame', () => {
  test.use({ seeded: { scale: 'medium', desktop: true, preview: true } });

  test('phone: view switch, Cockpit and the pencil share one row', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openOverview(page, 'calm', true);
    const head = page.getByTestId('overview-head');
    const [group, cockpit, pencil] = await Promise.all([
      head.getByRole('group', { name: 'Übersicht' }).boundingBox(),
      head.getByTestId('cockpit-enter').boundingBox(),
      head.getByRole('button', { name: 'Anpassen' }).boundingBox(),
    ]);
    const middle = (b: { y: number; height: number } | null) => b!.y + b!.height / 2;
    expect(
      Math.abs(middle(pencil) - middle(group)),
      'pencil in the row of the switch',
    ).toBeLessThan(4);
    expect(
      Math.abs(middle(cockpit) - middle(group)),
      'Cockpit in the row of the switch',
    ).toBeLessThan(4);
    // Cockpit is a full touch target; the pencil is the shared icon button (40 px drawn, 44 px hit area).
    expect(cockpit!.width).toBeGreaterThanOrEqual(44);
    expect(cockpit!.height).toBeGreaterThanOrEqual(44);
    expect(pencil!.width).toBeGreaterThanOrEqual(40);
    expect(pencil!.x + pencil!.width, 'pencil at the right end of the row').toBeGreaterThan(
      PHONE.width - 24,
    );
    // Icon only on the phone, but the button keeps its name.
    await expect(head.getByRole('button', { name: 'Cockpit' })).toBeVisible();
  });

  for (const width of [1280, 1920])
    test(`desktop ${width}: search, greeting and content share the left edge, bar and head the right one`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1080 });
      await openOverview(page, 'all', false);
      const edges = await page.evaluate(() => {
        const visible = (e: Element) => e.getBoundingClientRect().width > 0;
        const left = (sel: string) => document.querySelector(sel)!.getBoundingClientRect().left;
        const bar = [...document.querySelector('[data-topbar]')!.children].filter(visible);
        const tools = [
          ...document.querySelectorAll(
            '[data-testid="overview-head"] button, [data-testid="overview-head"] a',
          ),
        ].filter(visible);
        return {
          search: bar[0]!.getBoundingClientRect().left,
          title: left('main h1'),
          strip: left('[data-testid="attention"]'),
          agenda: left('[data-testid="agenda"]'),
          grid: left('[data-testid="home-grid"]'),
          barEnd: Math.max(...bar.map((e) => e.getBoundingClientRect().right)),
          headEnd: Math.max(...tools.map((e) => e.getBoundingClientRect().right)),
          gridEnd: document.querySelector('[data-testid="home-grid"]')!.getBoundingClientRect()
            .right,
        };
      });
      for (const key of ['title', 'strip', 'agenda', 'grid'] as const)
        expect(Math.abs(edges[key] - edges.search), `left edge: ${key}`).toBeLessThanOrEqual(1);
      expect(Math.abs(edges.barEnd - edges.headEnd), 'right edge: head').toBeLessThanOrEqual(1);
      expect(Math.abs(edges.barEnd - edges.gridEnd), 'right edge: content').toBeLessThanOrEqual(1);
    });
});
