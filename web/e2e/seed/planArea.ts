import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { measurePage, surfaceMetrics } from '../../scripts/lib/stimulusBudget';
import { openPage } from './guards';

/**
 * Shared reader of the plan-area guards (UI audit 2026-11, package 0b-4; Identity 4.0, rules 1, 4 and 5), after the
 * pattern of `money-area.seed.spec.ts`: surfaces are tone steps (no framed element and no shadow in `main`), the first
 * content of a page starts at y ≤ 220 px on the phone, the views are `Tabs`, the head holds exactly one action, nothing
 * in the head is cut, rows are at least 48 px high on the phone and 44 px on the desktop.
 *
 * A helper of its own, so the second half of the package (0b-4b: Gewohnheiten, Zeiterfassung, Wetter, Karten, Personen,
 * Planer, Uhr) adds its pages in a new spec file without touching this one.
 *
 * `PLAN_SHOTS=<dir>` also writes a picture of every checked first screen (for the pull request).
 */
export const CONTENT_Y_PHONE = 220;
const SHOTS = process.env.PLAN_SHOTS;

export interface PageRule {
  path: string;
  /** Largest count of coloured text and surfaces above the fold (light theme). */
  colouredMax: number;
  /** Fewest tabs in the head's tab row (0: the page has no views). */
  tabsMin: number;
  /** The head shows a figure (its number and context line are then checked for cuts). */
  figure: boolean;
  /** The page has an entry: one filled action in the head on the desktop, the named plus on the phone. */
  action: boolean;
}

interface Read {
  /** Top of the first thing of the page below the head (viewport px). */
  contentY: number | null;
  headHeight: number;
  /** Buttons in the head's action zone that are filled (`data-variant="primary"`). */
  primaries: string[];
  /** Every visible control of the head's action zone. */
  headControls: string[];
  /** The views of the page: tabs in the head's tab row, and segmented controls that sit there instead. */
  tabs: number;
  segmentedInTabs: number;
  /** The head figure's number and context line: wider than their box (cut) or not. */
  figure: { value: string; valueCut: boolean; detail: string; detailCut: boolean } | null;
  /** Row heights of the first list rows (`data-row`'s list item). */
  rowHeights: number[];
  sideways: boolean;
  /** The page's h1 is cut (the figure beside it took its room). */
  titleCut: boolean;
}

/** Runs in the page. */
function read(): Read {
  const main = document.querySelector('main')!;
  const head = document.querySelector<HTMLElement>('[data-testid="module-frame"]');
  const headBox = head?.getBoundingClientRect();
  const shown = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  // The first leaf with text or a control that lies below the head.
  let contentY: number | null = null;
  for (const el of Array.from(main.querySelectorAll<HTMLElement>('*'))) {
    if (head?.contains(el) || !shown(el)) continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    const ownText = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '',
    );
    if (!ownText && !el.matches('button, input, select, svg')) continue;
    const top = el.getBoundingClientRect().top;
    if (headBox && top < headBox.bottom - 1) continue;
    if (contentY === null || top < contentY) contentY = Math.round(top);
  }
  const actions = head?.querySelector('[data-testid="module-actions"]');
  // The gear ("Dieses Modul anpassen") is the shell's, not the page's.
  const controls = Array.from(actions?.querySelectorAll<HTMLElement>('button, a[href]') ?? [])
    .filter(shown)
    .filter((el) => !/Modul anpassen/.test(el.getAttribute('aria-label') ?? ''));
  const name = (el: Element) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
  const tabsRow = head?.querySelector('[data-slot="tabs"]');
  const figure = head?.querySelector<HTMLElement>('[data-testid="module-figure"]');
  const figureSpans = Array.from(
    figure?.querySelectorAll<HTMLElement>('span, strong, p') ?? [],
  ).filter((el) => shown(el) && el.children.length === 0 && (el.textContent ?? '').trim() !== '');
  const detail = figureSpans.find((el) => getComputedStyle(el).textOverflow === 'ellipsis');
  // The number is the figure's largest text (a hidden value's placeholder counts as well).
  const value = Array.from(figure?.querySelectorAll<HTMLElement>('span') ?? [])
    .filter((el) => shown(el) && el !== detail && !detail?.contains(el))
    .sort(
      (a, b) => parseFloat(getComputedStyle(b).fontSize) - parseFloat(getComputedStyle(a).fontSize),
    )[0];
  return {
    contentY,
    headHeight: Math.round(headBox?.height ?? 0),
    primaries: controls.filter((c) => c.getAttribute('data-variant') === 'primary').map(name),
    headControls: controls.map(name),
    tabs: tabsRow?.querySelectorAll('nav button, nav a').length ?? 0,
    segmentedInTabs: tabsRow?.querySelectorAll('[role="group"] [aria-pressed]').length ?? 0,
    figure:
      figure && shown(figure)
        ? {
            value: (value?.textContent ?? '').trim(),
            valueCut: value ? value.scrollWidth > value.clientWidth + 1 : false,
            detail: (detail?.textContent ?? '').trim(),
            detailCut: detail ? detail.scrollWidth > detail.clientWidth + 1 : false,
          }
        : null,
    rowHeights: Array.from(main.querySelectorAll<HTMLElement>('[data-row]'))
      .filter(shown)
      .slice(0, 12)
      .map((el) => Math.round((el.closest('li') ?? el).getBoundingClientRect().height)),
    sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    titleCut: (() => {
      const h1 = head?.querySelector('h1');
      return !!h1 && h1.scrollWidth > h1.clientWidth;
    })(),
  };
}

/** Runs in the page: tag and class of what may be a frame or a shadow in `main`, to name it when a count fails. */
function suspects(): string[] {
  const main = document.querySelector('main')!;
  return Array.from(main.querySelectorAll<HTMLElement>('*'))
    .filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 24 || el.matches('input, select, textarea, button'))
        return false;
      const s = getComputedStyle(el);
      const w = s.borderTopWidth;
      const framed =
        s.borderTopStyle === 'solid' &&
        parseFloat(w) > 0 &&
        s.borderBottomWidth === w &&
        s.borderLeftWidth === w &&
        s.borderRightWidth === w;
      return framed || (s.boxShadow !== 'none' && s.boxShadow !== '');
    })
    .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`)
    .slice(0, 12);
}

/** Opens `rule.path` in the started, seeded app and checks it; returns what it read (for the run's log). */
export async function checkPlanPage(
  page: Page,
  rule: PageRule,
  { phone, theme }: { phone: boolean; theme: 'light' | 'dark' },
): Promise<Record<string, unknown>> {
  const { path } = rule;
  await openPage(page, path);
  // The Dev-Preview notice would lie over the picture.
  const notice = page.getByRole('button', { name: 'Schließen', exact: true });
  if (await notice.count()) await notice.first().click();
  // Live queries settle.
  await page.waitForTimeout(600);
  const r = await page.evaluate(read);
  const m = surfaceMetrics(await page.evaluate(measurePage));
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    const name = path.slice(1).replace(/[?=&]/g, '-');
    await page.screenshot({
      path: join(SHOTS, `${phone ? 'phone' : 'desktop'}-${theme}-${name}.png`),
    });
  }
  // Rule 1: tone steps. No page of the area has a signature block.
  const named = m.borders + m.shadows > 0 ? (await page.evaluate(suspects)).join(' | ') : '';
  expect.soft(m.borders, `${path}: framed elements in main (${named})`).toBe(0);
  expect.soft(m.shadows, `${path}: shadows in main (${named})`).toBe(0);
  expect.soft(m.signatureBlocks, `${path}: signature blocks`).toBe(0);
  // The measurement reads the dark neutral steps as colour (decisions: calm guard), so colour is counted in light.
  if (theme === 'light')
    expect
      .soft(m.colouredAboveFold, `${path}: coloured text and surfaces above the fold`)
      .toBeLessThanOrEqual(rule.colouredMax);
  // Rule 2/4: tabs for the views, one action in the head (desktop), none on the phone.
  expect.soft(r.segmentedInTabs, `${path}: a Segmented in the row of the tabs`).toBe(0);
  expect.soft(r.tabs, `${path}: the views are tabs`).toBeGreaterThanOrEqual(rule.tabsMin);
  if (phone) {
    expect.soft(r.headControls, `${path}: the phone's head holds no action`).toEqual([]);
    if (rule.action)
      await expect
        .soft(page.getByTestId('bottom-plus'), `${path}: the plus is the page's action`)
        .toHaveAccessibleName(/\S+ eintragen$/);
    // Rule 5: the page starts on the first screen.
    expect.soft(r.contentY, `${path}: first content below the head`).not.toBeNull();
    expect
      .soft(r.contentY ?? 9999, `${path}: content starts at y ≤ ${CONTENT_Y_PHONE} px`)
      .toBeLessThanOrEqual(CONTENT_Y_PHONE);
  } else {
    if (rule.action)
      expect.soft(r.primaries, `${path}: exactly one filled action in the head`).toHaveLength(1);
    // The filled action and the "⋯" menu, nothing else (no "Erweitert" switch, no second button).
    expect
      .soft(r.headControls.length, `${path}: ${r.headControls.join(' | ')}`)
      .toBeLessThanOrEqual(2);
    await expect
      .soft(page.locator('[data-testid="module-actions"] [role="switch"]'), `${path}: no switch`)
      .toHaveCount(0);
  }
  // Nothing in the head is cut: the figure, its context line where the page promises one, the h1.
  if (rule.figure) {
    expect.soft(r.figure, `${path}: the head has its figure`).not.toBeNull();
    expect.soft(r.figure?.valueCut, `${path}: the figure "${r.figure?.value}" is cut`).toBe(false);
  }
  expect.soft(r.titleCut, `${path}: the h1 is cut`).toBe(false);
  expect.soft(r.sideways, `${path}: no sideways overflow`).toBe(false);
  // Rule 5: 48 px rows on the phone, 44 px on the desktop (a row may be taller, never lower).
  for (const h of r.rowHeights)
    expect.soft(h, `${path}: row height`).toBeGreaterThanOrEqual(phone ? 48 : 44);
  return {
    contentY: r.contentY,
    head: r.headHeight,
    borders: m.borders,
    shadows: m.shadows,
    coloured: m.colouredAboveFold,
    figure: r.figure,
    rows: r.rowHeights.slice(0, 3),
  };
}

/** Inputs, selects and text areas of the open dialog that are on screen. */
export const visibleFields = (page: Page) =>
  page
    .getByRole('dialog')
    .locator('input:not([type="hidden"]), select, textarea')
    .evaluateAll(
      (els) =>
        els.filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 1 && r.height > 1 && !e.closest('[aria-hidden="true"]');
        }).length,
    );
