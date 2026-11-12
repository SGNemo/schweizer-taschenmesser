import { expect, type Page } from '@playwright/test';
import { test } from './helpers';
import { DESKTOP, MODULE_IDS, openPage, startSeeded } from './guards';

/**
 * The app frame (UI audit 2026-11, package 0b-R): sidebar, collapsed rail and top bar lie on tone steps like the
 * pages they stand around. No frame and no shadow, AA on every surface that is left, the search flush with the page,
 * the bar's last control flush with the head's action, 44 px targets with a mouse outside the low-window exception,
 * and a visible focus outline on every kind of target.
 */
test.use({ viewport: DESKTOP, seeded: { scale: 'small', desktop: true, preview: true } });

const FRAME = '[data-testid="sidebar"], [data-topbar]';

async function start(page: Page, sidebar: 'wide' | 'narrow') {
  await page.addInitScript((choice) => localStorage.setItem('tm-sidebar', choice), sidebar);
  await startSeeded(page);
}

/** Elements of the frame with a border on all four sides or a box shadow; the shared "Neu" button keeps its outline. */
function framesAndShadows(scope: string): string[] {
  const found: string[] = [];
  for (const root of document.querySelectorAll(scope))
    for (const el of [root, ...root.querySelectorAll('*')]) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const s = getComputedStyle(el);
      const name = `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}"`;
      const sides = (['Top', 'Right', 'Bottom', 'Left'] as const).filter(
        (side) =>
          parseFloat(s[`border${side}Width`]) > 0 &&
          s[`border${side}Style`] !== 'none' &&
          s[`border${side}Color`] !== 'rgba(0, 0, 0, 0)',
      );
      if (sides.length === 4 && !el.matches('button[class*="btn"], button[class*="btn"] *'))
        found.push(`frame: ${name}`);
      if (s.boxShadow !== 'none') found.push(`shadow: ${name}`);
    }
  return found;
}

/**
 * Texts under 4.5:1 and icons of links and buttons under 3:1, each against the surface composed of every background
 * under it. Colours are painted onto a canvas, so `color-mix()` and translucent fills count as the browser draws them.
 */
function lowContrast(scope: string): string[] {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const paint = (colour: string) => {
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, 1, 1);
  };
  const read = () => [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  const lum = (rgb: number[]) => {
    const [r, g, b] = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratioOn = (el: Element, colour: string) => {
    const chain: Element[] = [];
    for (let e: Element | null = el; e; e = e.parentElement) chain.unshift(e);
    ctx.clearRect(0, 0, 1, 1);
    paint('#fff');
    for (const e of chain) paint(getComputedStyle(e).backgroundColor);
    const bg = lum(read());
    paint(colour);
    const fg = lum(read());
    return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  };
  const low: string[] = [];
  for (const root of document.querySelectorAll(scope))
    for (const el of root.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden') continue;
      const host = el.closest('a, button');
      const label = (host?.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24);
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      if (ownText && !el.closest('svg')) {
        const ratio = ratioOn(el, s.color);
        if (ratio < 4.5) low.push(`text ${ratio.toFixed(2)} "${label}"`);
      }
      // The brand mark is a picture, not an icon of the interface.
      if (el.tagName === 'svg' && host && !host.matches('[class*="brand"]')) {
        const ratio = ratioOn(el, s.color);
        if (ratio < 3) low.push(`icon ${ratio.toFixed(2)} "${label}"`);
      }
    }
  return low;
}

/** Links and buttons of the frame whose hit area (their box, or a 44 px `::after` strip over it) is under 44 px. */
function smallTargets(scope: string): string[] {
  const MIN = 44;
  const small: string[] = [];
  for (const root of document.querySelectorAll(scope))
    for (const el of root.querySelectorAll<HTMLElement>('a[href], button')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width >= MIN && r.height >= MIN) continue;
      const after = getComputedStyle(el, '::after');
      const inset = ['left', 'right', 'top', 'bottom'].map((side) =>
        parseFloat(after.getPropertyValue(side)),
      ) as [number, number, number, number];
      const extended =
        after.content !== 'none' &&
        after.position === 'absolute' &&
        inset.every(Number.isFinite) &&
        r.width - inset[0] - inset[1] >= MIN - 0.5 &&
        r.height - inset[2] - inset[3] >= MIN - 0.5;
      if (!extended)
        small.push(
          `${Math.round(r.width)}×${Math.round(r.height)} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}"`,
        );
    }
  return small;
}

for (const scheme of ['light', 'dark'] as const)
  for (const sidebar of ['wide', 'narrow'] as const)
    test(`no frame and no shadow in the app frame (${scheme}, ${sidebar})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await start(page, sidebar);
      for (const path of ['/finance', '/settings', '/']) {
        await openPage(page, path);
        expect
          .soft(await page.evaluate(framesAndShadows, FRAME), `${path}: frames and shadows`)
          .toEqual([]);
      }
    });

for (const scheme of ['light', 'dark'] as const)
  test(`text and icons of the app frame keep AA on every module page (${scheme})`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ colorScheme: scheme });
    await start(page, 'wide');
    for (const path of ['/', '/library', '/settings', ...MODULE_IDS.map((id) => `/${id}`)]) {
      await openPage(page, path);
      expect.soft(await page.evaluate(lowContrast, FRAME), `${path}: contrast`).toEqual([]);
    }
    // Collapsed: the active area's tile is the one tinted surface of the rail.
    await page.evaluate(() => localStorage.setItem('tm-sidebar', 'narrow'));
    for (const path of ['/', '/settings', '/finance', '/todos', '/pantry', '/notes', '/vault']) {
      await openPage(page, path);
      expect.soft(await page.evaluate(lowContrast, FRAME), `${path} (rail): contrast`).toEqual([]);
    }
  });

for (const width of [1280, 1920])
  for (const sidebar of ['wide', 'narrow'] as const)
    test(`search and page share the left edge, bar and head action the right one (${width}, ${sidebar})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1080 });
      await start(page, sidebar);
      // Kalender fills the window (`layout: 'full'`), whatever its width.
      await openPage(page, '/calendar');
      const edges = await page.evaluate(() => {
        const visible = (e: Element) => e.getBoundingClientRect().width > 0;
        const bar = [...document.querySelector('[data-topbar]')!.children].filter(visible);
        const main = document.querySelector('main')!;
        const head = main.querySelector('h1')!.closest('[data-head]')!;
        const actions = [...head.querySelectorAll('button, a[href]')].filter(visible);
        return {
          search: bar[0]!.getBoundingClientRect().left,
          page: main.getBoundingClientRect().left + parseFloat(getComputedStyle(main).paddingLeft),
          barEnd: Math.max(...bar.map((e) => e.getBoundingClientRect().right)),
          headEnd: Math.max(...actions.map((e) => e.getBoundingClientRect().right)),
        };
      });
      expect(Math.abs(edges.search - edges.page), 'left edge').toBeLessThanOrEqual(1);
      expect(Math.abs(edges.barEnd - edges.headEnd), 'right edge').toBeLessThanOrEqual(1);
    });

test('with a mouse in a tall window every target of the frame is at least 44 px', async ({
  page,
}) => {
  // Above 1100 px the compact rows for low mouse windows do not apply (docs/howto/design-rules.md).
  await page.setViewportSize({ width: 1920, height: 1200 });
  await start(page, 'wide');
  await openPage(page, '/finance');
  expect(await page.evaluate(smallTargets, FRAME), 'sidebar').toEqual([]);
  await page.evaluate(() => localStorage.setItem('tm-sidebar', 'narrow'));
  await openPage(page, '/finance');
  // The time under the tile is a 24 px line for the mouse, as the rule names it.
  const rail = await page.evaluate(smallTargets, FRAME);
  expect(
    rail.filter((t) => !t.includes('Uhr')),
    'rail',
  ).toEqual([]);
});

test('every kind of target in the frame shows the focus outline', async ({ page }) => {
  await start(page, 'wide');
  await openPage(page, '/finance');
  const side = page.getByTestId('sidebar');
  const targets = {
    favourite: side.locator('ul a[aria-label="Finanzen"]'),
    row: side.getByRole('link', { name: 'Rechnungen', exact: true }),
    'current row': side.locator('li a[aria-current="page"]').last(),
    pin: side.locator('button[aria-pressed]').first(),
    'area head': side.locator('button[aria-expanded]').first(),
    search: page.locator('[data-topbar] button').first(),
    bell: page.locator('[data-topbar] button').last(),
  };
  for (const [name, target] of Object.entries(targets)) {
    await target.focus();
    // Keyboard focus, so `:focus-visible` applies.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement!);
      return `${s.outlineStyle} ${s.outlineWidth} offset ${s.outlineOffset}`;
    });
    expect.soft(outline, name).toBe('solid 2px offset 2px');
  }
});
