import { expect, type Page } from '@playwright/test';
import { measurePage, surfaceMetrics } from '../../scripts/lib/stimulusBudget';
import { test } from './helpers';
import { DESKTOP, openPage, PHONE, startSeeded } from './guards';

/**
 * The tab "Verlauf" of Finanzen after package G-b of UI audit 2026-11 (net worth): the head's one figure is the net
 * worth, named in its context line and never cut; the context line of the tab wraps instead of ending in "…" and
 * carries no amount; the rows by kind and the curve lie on tone steps (no frame, no shadow); the page starts on the
 * first screen of the phone; the head's figure stands once on the page; the curve is readable in both themes (its line
 * has a contrast of at least 3:1 against its card).
 */
const CONTENT_Y_PHONE = 220;
const AMOUNT = /\d,\d\d\s?€/;

interface Read {
  figure: string;
  figureCut: boolean;
  detail: string;
  detailCut: boolean;
  titleCut: boolean;
  context: string;
  contextCut: boolean;
  contextY: number;
  rows: number[];
  sideways: boolean;
  /** Contrast of the curve's line against the card it lies on. */
  lineContrast: number;
  /** How often the head's amount stands in the text of `main` that is drawn (not the screen-reader table). */
  figureCount: number;
}

/** Runs in the page. */
function read(): Read {
  const main = document.querySelector('main')!;
  const hero = document.querySelector<HTMLElement>('[data-testid="hero"]')!;
  const detail = Array.from(
    document.querySelector('[data-testid="module-figure"]')!.querySelectorAll<HTMLElement>('span'),
  ).find((el) => getComputedStyle(el).textOverflow === 'ellipsis');
  const h1 = document.querySelector<HTMLElement>('[data-testid="module-frame"] h1')!;
  const context = document.querySelector<HTMLElement>('[data-testid="net-worth-context"]')!;
  const rgb = (value: string): [number, number, number] => {
    const c = document.createElement('canvas').getContext('2d')!;
    c.fillStyle = value;
    c.fillRect(0, 0, 1, 1);
    const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
    return [r!, g!, b!];
  };
  const luminance = ([r, g, b]: [number, number, number]) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const chart = document.querySelector<SVGElement>('[data-testid="net-worth-chart"]')!;
  const line = Array.from(chart.querySelectorAll('path')).find(
    (p) => getComputedStyle(p).fill === 'none',
  )!;
  let surface: Element | null = chart;
  let background = 'rgba(0, 0, 0, 0)';
  while (surface && /rgba\(.*,\s*0\)$|transparent/.test(background)) {
    surface = surface.parentElement;
    if (surface) background = getComputedStyle(surface).backgroundColor;
  }
  const a = luminance(rgb(getComputedStyle(line).stroke));
  const b = luminance(rgb(background));
  const amount = (hero.textContent ?? '').trim();
  // What the eye reads: the table for screen readers under the curve holds every month's value by design.
  let seen = '';
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode())
    if (!n.parentElement?.closest('.sr-only')) seen += `${n.textContent ?? ''}\n`;
  return {
    figure: amount,
    figureCut: hero.scrollWidth > hero.clientWidth + 1,
    detail: (detail?.textContent ?? '').trim(),
    detailCut: detail ? detail.scrollWidth > detail.clientWidth + 1 : true,
    titleCut: h1.scrollWidth > h1.clientWidth,
    context: (context.textContent ?? '').trim(),
    contextCut:
      context.scrollWidth > context.clientWidth + 1 ||
      getComputedStyle(context).textOverflow === 'ellipsis',
    contextY: Math.round(context.getBoundingClientRect().top),
    rows: Array.from(main.querySelectorAll<HTMLElement>('[data-testid="net-worth-parts"] li')).map(
      (el) => Math.round(el.getBoundingClientRect().height),
    ),
    sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    lineContrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
    figureCount: seen.split(amount).length - 1,
  };
}

async function check(page: Page, phone: boolean) {
  await startSeeded(page, { phone });
  await openPage(page, '/finance?tab=trend');
  const notice = page.getByRole('button', { name: 'Schließen', exact: true });
  if (await notice.count()) await notice.first().click();
  await expect(page.getByTestId('net-worth-chart')).toBeVisible();
  await expect(page.getByTestId('net-worth-context')).toContainText('Monatsende');
  const r = await page.evaluate(read);
  const m = surfaceMetrics(await page.evaluate(measurePage));
  console.log(`net worth ${phone ? 'phone' : 'desktop'}: ${JSON.stringify({ ...r, m })}`);
  // The head's one figure: the net worth, named beside it, nothing cut (the medium seed has the long numbers).
  expect.soft(r.figure, 'the head figure is an amount').toMatch(AMOUNT);
  expect.soft(r.detail, 'the context line names the figure').toMatch(/^Vermögen · \d+ Konten?$/);
  expect.soft(r.figureCut, `the figure "${r.figure}" is cut`).toBe(false);
  expect.soft(r.detailCut, `the head's context line "${r.detail}" is cut`).toBe(false);
  expect.soft(r.titleCut, 'the h1 is cut').toBe(false);
  // B2: the number stands once (the foot of the curve names the month, not the amount again).
  expect.soft(r.figureCount, `"${r.figure}" on the page`).toBe(1);
  // The tab's context line: what is still open, the important first, no amount, wrapped and never cut.
  expect.soft(r.context, 'context line').not.toMatch(AMOUNT);
  expect.soft(r.contextCut, `the context line "${r.context}" is cut`).toBe(false);
  // The seed has three kinds of account: one row each, 48 px on the phone, 44 px on the desktop.
  expect.soft(r.rows.length, 'rows by kind').toBeGreaterThanOrEqual(2);
  for (const h of r.rows) expect.soft(h, 'row height').toBeGreaterThanOrEqual(phone ? 48 : 44);
  // Tone steps: no frame and no shadow in `main`.
  expect.soft(m.borders, 'framed elements in main').toBe(0);
  expect.soft(m.shadows, 'shadows in main').toBe(0);
  expect.soft(r.sideways, 'no sideways overflow').toBe(false);
  if (phone)
    expect
      .soft(r.contextY, `content starts at y ≤ ${CONTENT_Y_PHONE} px`)
      .toBeLessThanOrEqual(CONTENT_Y_PHONE);
  // Readable curve: a graphical object needs 3:1 against its surface (WCAG 1.4.11).
  expect.soft(r.lineContrast, 'contrast of the curve against its card').toBeGreaterThanOrEqual(3);
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`net worth on the tab "Verlauf" (package G-b), ${theme}`, () => {
    test.use({ colorScheme: theme });
    test.setTimeout(120_000);

    test.describe('desktop', () => {
      test.use({ viewport: DESKTOP, seeded: { scale: 'medium', desktop: true, preview: true } });
      test('figure named and whole, rows by kind, readable curve', async ({ page }) => {
        await check(page, false);
      });
    });

    test.describe('phone', () => {
      test.use({
        viewport: PHONE,
        isMobile: true,
        hasTouch: true,
        seeded: { scale: 'medium', preview: true },
      });
      test('content from y ≤ 220 px, nothing cut, readable curve', async ({ page }) => {
        await check(page, true);
      });
    });
  });
}
