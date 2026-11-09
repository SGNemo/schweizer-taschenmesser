import { expect, type Page } from '@playwright/test';
import { bootDev, test } from './helpers';

/**
 * UI round 6, overview + settings + libraries (docs/qa/round-6, ids U19, U49, U03, U31, U54, U55, U32), measured on
 * the seeded Dev-Preview: the overview grid has no holes, "Jetzt wichtig" ends flush with the day cards, the settings
 * cards never break inside a word and line up with the status tiles, the navigation state stays on its line, the
 * current settings group is marked, the phone's status tiles keep their context line, and library cards of one row
 * have the same head and foot.
 */
async function start(page: Page, path: string) {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('tm-show-preview', '1');
    if (innerWidth >= 900) localStorage.setItem('__tmPlatformKind', 'desktop');
  });
  await bootDev(page);
  await page.goto(path);
  await expect(page.locator('main h1').first()).toBeVisible();
}

/** Words whose glyphs sit on two lines inside `root` (the round-6 tour's `wordBreaks` detector, trimmed). */
function wordBreaks(page: Page, root: string) {
  return page.evaluate((sel) => {
    const scope = document.querySelector(sel);
    if (!scope) return ['no scope'];
    const out: string[] = [];
    for (const el of Array.from(scope.querySelectorAll<HTMLElement>('*'))) {
      if (el.children.length > 0 || (el.textContent ?? '').trim().length < 6) continue;
      const node = el.firstChild;
      if (!node || node.nodeType !== Node.TEXT_NODE) continue;
      const s = getComputedStyle(el);
      const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3;
      const text = node.textContent ?? '';
      const re = /[A-Za-zÄÖÜäöüß0-9€.,%]{5,}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0);
        if (rects.length > 1 && Math.abs(rects[0]!.top - rects[rects.length - 1]!.top) > lh * 0.5)
          out.push(m[0]);
      }
    }
    return out;
  }, root);
}

test.describe('UI round 6 – desktop 1920', () => {
  test.use({
    viewport: { width: 1920, height: 1080 },
    seeded: { scale: 'small', desktop: true, preview: true },
  });

  test('U19: the detailed overview has no holes between widgets', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tm-home-view', 'all'));
    await start(page, '/');
    const grid = page.getByTestId('home-grid');
    await expect(grid).toHaveAttribute('data-packed', 'true');
    // Lazy widgets load and re-pack: poll until the grid has settled without holes.
    const holes = () =>
      grid.evaluate((g) => {
        const gap = parseFloat(getComputedStyle(g).columnGap);
        const boxes = Array.from(g.children).map((c) => {
          const r = c.getBoundingClientRect();
          return {
            id: c.getAttribute('data-testid'),
            x: r.left,
            y: r.top,
            w: r.width,
            h: r.height,
          };
        });
        const top = Math.min(...boxes.map((b) => b.y));
        // Above every card, in the columns it covers, the nearest card ends one gap higher (or the grid starts).
        return boxes
          .map((b) => {
            const above = boxes
              .filter((o) => o.y < b.y && o.x < b.x + b.w - 1 && o.x + o.w > b.x + 1)
              .map((o) => o.y + o.h);
            return { id: b.id, free: Math.round(b.y - (above.length ? Math.max(...above) : top)) };
          })
          .filter((x) => x.free > gap + 2);
      });
    await expect.poll(holes, { timeout: 15_000 }).toEqual([]);
  });

  test('U49: the calm overview ends flush with the day cards', async ({ page }) => {
    await start(page, '/');
    // The seeded calm view shows the one "Heute" card (no pins); wait for it before measuring.
    const widgets = page.locator('[data-testid="home-grid"] > [data-testid^="widget-"]');
    await expect(widgets).toHaveCount(1);
    const agenda = await page.getByTestId('agenda').boundingBox();
    const strip = page.locator('section[aria-label="Jetzt wichtig"] > ul').first();
    await expect(strip).toBeVisible();
    const list = await strip.boundingBox();
    const cards = await strip
      .locator(':scope > li')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
    const grid = await page.getByTestId('home-grid').boundingBox();
    expect(agenda && list && grid).toBeTruthy();
    // The cards share the full width: the last one ends where the day cards end.
    expect(cards.length).toBeGreaterThan(0);
    expect(Math.abs(Math.max(...cards) - agenda!.x - agenda!.width)).toBeLessThan(2);
    // The single calm card takes the full width.
    const w = await widgets.first().boundingBox();
    expect(Math.abs(w!.width - grid!.width)).toBeLessThan(2);
  });

  test('U03 + U31: settings cards never break inside a word and line up; the nav state keeps its line', async ({
    page,
  }) => {
    await start(page, '/settings');
    await expect(page.getByTestId('settings-overview')).toBeVisible();
    expect(await wordBreaks(page, '#main')).toEqual([]);
    const tiles = await page
      .getByTestId('settings-status')
      .locator(':scope > li')
      .evaluateAll((els) => els.slice(0, 3).map((e) => Math.round(e.getBoundingClientRect().left)));
    const cards = await page
      .getByTestId('settings-overview')
      .locator('li')
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    expect(cards).toEqual(tiles);
    // "Benachrichtigungen" with its state is one line, as tall as a link without a state.
    const nav = page.locator('nav').filter({ has: page.locator('a[href="/settings/sicherheit"]') });
    const withState = await nav.locator('a[href="/settings/benachrichtigungen"]').boundingBox();
    const plain = await nav.locator('a[href="/settings/sicherheit"]').boundingBox();
    expect(withState!.height).toBeLessThanOrEqual(plain!.height + 1);
  });

  test('U54: the current settings group is marked and the text line names its values', async ({
    page,
  }) => {
    await start(page, '/settings/darstellung');
    const subnav = page.getByTestId('subnav-darstellung');
    await expect(subnav.locator('a[aria-current]')).toHaveCount(1);
    await expect(subnav.locator('a').first()).toHaveAttribute('aria-current', 'location');
    await expect(page.locator('main')).toContainText('Textgröße normal · Zeilenabstand normal');
    await subnav.locator('a').nth(1).click();
    await expect(subnav.locator('a').nth(1)).toHaveAttribute('aria-current', 'location');
  });

  test('U32: library cards of one row share head height and foot rows', async ({ page }) => {
    await start(page, '/tools');
    // The cards arrive with the tool list: wait for them before measuring.
    await expect(page.locator('[data-testid^="tool-"]').nth(3)).toBeVisible();
    const heads = await page
      .locator('[data-testid^="tool-"] > div:first-child')
      .evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return {
            top: Math.round(e.closest('li')!.getBoundingClientRect().top),
            h: Math.round(r.height),
          };
        }),
      );
    expect(heads.length).toBeGreaterThan(3);
    const byRow = new Map<number, Set<number>>();
    for (const h of heads) byRow.set(h.top, (byRow.get(h.top) ?? new Set()).add(h.h));
    for (const [top, set] of byRow) expect([...set], `tool row at ${top}`).toHaveLength(1);

    await page.goto('/library');
    await expect(page.locator('[data-testid^="module-"] [role="switch"]').nth(3)).toBeVisible();
    // Every module card: the switch sits on its own row below "Details".
    const rows = await page.locator('[data-testid^="module-"]').evaluateAll((els) =>
      els
        .map((card) => {
          const details = card.querySelector('a[href^="/library/"]')?.getBoundingClientRect();
          const sw = card.querySelector('[role="switch"]')?.getBoundingClientRect();
          return details && sw ? sw.top - details.bottom : null;
        })
        .filter((x): x is number => x !== null),
    );
    expect(rows.length).toBeGreaterThan(3);
    for (const gap of rows) expect(gap).toBeGreaterThanOrEqual(0);
  });
});

for (const width of [1280, 1024]) {
  test.describe(`UI round 6 – settings at ${width}`, () => {
    test.use({
      viewport: { width, height: 800 },
      seeded: { scale: 'small', desktop: true, preview: true },
    });

    test('U03: the overview cards keep their titles whole and inside the card', async ({
      page,
    }) => {
      await start(page, '/settings');
      await expect(page.getByTestId('settings-overview')).toBeVisible();
      expect(await wordBreaks(page, '[data-testid="settings-overview"]')).toEqual([]);
      const spill = await page
        .getByTestId('settings-overview')
        .locator('a')
        .evaluateAll((cards) =>
          cards.flatMap((card) => {
            const box = card.getBoundingClientRect();
            return Array.from(card.querySelectorAll<HTMLElement>('span'))
              .filter((e) => e.getBoundingClientRect().right > box.right - 1)
              .map((e) => e.textContent ?? '');
          }),
        );
      expect(spill).toEqual([]);
    });
  });
}

test.describe('UI round 6 – empty app 1920', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('U39: an empty widget is as tall as its one line, not its size class', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tm-home-view', 'all'));
    await start(page, '/');
    const empty = page.locator('[data-testid="home-grid"] > [data-empty]');
    await expect(empty.first()).toBeVisible();
    const heights = await empty.evaluateAll((els) =>
      els.map((e) => [e.getAttribute('data-testid'), Math.round(e.getBoundingClientRect().height)]),
    );
    expect(heights.length).toBeGreaterThan(3);
    expect(heights.filter(([, h]) => Number(h) > 160)).toEqual([]);
  });
});

test.describe('UI round 6 – phone 412', () => {
  test.use({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
    seeded: { scale: 'small', preview: true },
  });

  test('U55: the status tiles show no cut text and stay a strip', async ({ page }) => {
    await start(page, '/settings');
    // A line that only explains the state or the category stays off the phone, so the head stays a strip (focus
    // rule): the tiles are no taller than with the old one-line clamp (288 px on develop, 247 px here).
    const tiles = await page.getByTestId('settings-status').boundingBox();
    expect(tiles!.height).toBeLessThanOrEqual(290);
    const clipped = await page
      .getByTestId('settings-status')
      .locator('span')
      .evaluateAll((els) =>
        els
          .filter((e) => e.children.length === 0 && e.scrollHeight > e.clientHeight + 1)
          .map((e) => e.textContent ?? ''),
      );
    expect(clipped).toEqual([]);
  });
});
