import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { measurePage, surfaceMetrics } from '../../scripts/lib/stimulusBudget';
import { test } from './helpers';
import { DESKTOP, openPage, PHONE, startSeeded } from './guards';

/**
 * The money area after package 0b-3 of UI audit 2026-11 (Finanzen, Rechnungen, Abos, Budgets; rules 1, 4 and 5 of
 * Identity 4.0): surfaces are tone steps (no framed element and no shadow in `main`), the first content of the page
 * starts at y ≤ 220 px on the phone, at most ten coloured things above the fold, the views are `Tabs`, the head holds
 * exactly one action, a money figure and its context line are never cut on the phone, and rows are at least 48 px
 * high on the phone and 44 px on the desktop.
 *
 * `MONEY_SHOTS=<dir>` also writes a picture of every first screen in both themes (for the pull request).
 */
const PAGES = ['/finance', '/invoices', '/subscriptions', '/budgets'] as const;
const CONTENT_Y_PHONE = 220;
const COLOURED_MAX = 10;
const SHOTS = process.env.MONEY_SHOTS;

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

async function check(page: Page, phone: boolean, theme: string) {
  await startSeeded(page, { phone });
  const seen: Record<string, unknown> = {};
  for (const path of PAGES) {
    await openPage(page, path);
    // The Dev-Preview notice would lie over the picture.
    const notice = page.getByRole('button', { name: 'Schließen', exact: true });
    if (await notice.count()) await notice.first().click();
    // Lazy charts and live queries settle.
    await page.waitForTimeout(600);
    const r = await page.evaluate(read);
    const m = surfaceMetrics(await page.evaluate(measurePage));
    seen[path] = {
      contentY: r.contentY,
      head: r.headHeight,
      borders: m.borders,
      shadows: m.shadows,
      coloured: m.colouredAboveFold,
      figure: r.figure,
    };
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({
        path: join(SHOTS, `${phone ? 'phone' : 'desktop'}-${theme}-${path.slice(1)}.png`),
      });
    }
    // Rule 1: tone steps. None of the four pages has a signature block, so the counts are plain zero.
    expect.soft(m.borders, `${path}: framed elements in main`).toBe(0);
    expect.soft(m.shadows, `${path}: shadows in main`).toBe(0);
    expect.soft(m.signatureBlocks, `${path}: signature blocks`).toBe(0);
    // The measurement reads the dark neutral steps as colour (decisions: calm guard), so colour is counted in light.
    if (theme === 'light')
      expect
        .soft(m.colouredAboveFold, `${path}: coloured text and surfaces above the fold`)
        .toBeLessThanOrEqual(COLOURED_MAX);
    // Rule 2/4: tabs for the views, one action in the head (desktop), none on the phone.
    expect.soft(r.segmentedInTabs, `${path}: a Segmented in the row of the tabs`).toBe(0);
    if (path !== '/subscriptions')
      expect.soft(r.tabs, `${path}: the views are tabs`).toBeGreaterThanOrEqual(2);
    if (phone) {
      expect.soft(r.headControls, `${path}: the phone's head holds no action`).toEqual([]);
      const plus = page.getByTestId('bottom-plus');
      await expect
        .soft(plus, `${path}: the plus is the page's action`)
        .toHaveAccessibleName(/\S+ eintragen$/);
      // Rule 5: the page starts on the first screen.
      expect.soft(r.contentY, `${path}: first content below the head`).not.toBeNull();
      expect
        .soft(r.contentY ?? 9999, `${path}: content starts at y ≤ ${CONTENT_Y_PHONE} px`)
        .toBeLessThanOrEqual(CONTENT_Y_PHONE);
    } else {
      expect.soft(r.primaries, `${path}: exactly one filled action in the head`).toHaveLength(1);
      // The filled action and the "⋯" menu, nothing else (no "Erweitert" switch, no second button).
      expect
        .soft(r.headControls.length, `${path}: ${r.headControls.join(' | ')}`)
        .toBeLessThanOrEqual(2);
      await expect
        .soft(page.locator('[data-testid="module-actions"] [role="switch"]'), `${path}: no switch`)
        .toHaveCount(0);
    }
    // B2: a money figure is never cut, and neither is its context line (the important part comes first and fits).
    expect.soft(r.figure, `${path}: the head has its figure`).not.toBeNull();
    expect.soft(r.figure?.valueCut, `${path}: the figure "${r.figure?.value}" is cut`).toBe(false);
    expect
      .soft(r.figure?.detailCut, `${path}: the context line "${r.figure?.detail}" is cut`)
      .toBe(false);
    expect.soft(r.sideways, `${path}: no sideways overflow`).toBe(false);
    // The figure and its unit never push the title out (the medium seed has the longer numbers).
    expect.soft(r.titleCut, `${path}: the h1 is cut`).toBe(false);
    // Rule 5: 48 px rows on the phone, 44 px on the desktop (a row may be taller, never lower).
    for (const h of r.rowHeights)
      expect.soft(h, `${path}: row height`).toBeGreaterThanOrEqual(phone ? 48 : 44);
  }
  console.log(`money area ${phone ? 'phone' : 'desktop'} ${theme}: ${JSON.stringify(seen)}`);
}

for (const theme of SHOTS ? (['light', 'dark'] as const) : (['light'] as const)) {
  test.describe(`money area on tone steps (Identity 4.0, package 0b-3), ${theme}`, () => {
    test.use({ colorScheme: theme });
    test.setTimeout(120_000);

    test.describe('desktop', () => {
      test.use({ viewport: DESKTOP, seeded: { scale: 'medium', desktop: true, preview: true } });
      test('four pages: no frames, tabs, one action, nothing cut', async ({ page }) => {
        await check(page, false, theme);
      });
    });

    test.describe('phone', () => {
      test.use({
        viewport: PHONE,
        isMobile: true,
        hasTouch: true,
        seeded: { scale: 'medium', preview: true },
      });
      test('four pages: content from y ≤ 220 px, plus is the action, nothing cut', async ({
        page,
      }) => {
        await check(page, true, theme);
      });
    });
  });
}

/**
 * The booking dialog, "first what is needed" (finding B10): three fields, the rest folded with its values named, and
 * the click path "Buchung eintragen" is the head's action (or the plus) + typing + Enter.
 */
const visibleFields = (page: Page) =>
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

test.describe('booking dialog: three fields, one click and Enter', () => {
  test.describe('desktop', () => {
    test.use({ viewport: DESKTOP, seeded: { scale: 'small', desktop: true, preview: true } });
    test('"Buchung" in the head, an amount, Enter: the booking is in the list', async ({
      page,
    }) => {
      await startSeeded(page);
      await openPage(page, '/finance?tab=transactions');
      // Click 1 of at most 2: the page's one action.
      await page.locator('[data-page-action]').click();
      const dialog = page.getByRole('dialog', { name: 'Buchung hinzufügen' });
      await expect(dialog).toBeVisible();
      expect(await visibleFields(page), 'visible fields of a new booking').toBe(3);
      // What the folded fields will save stands beside "Mehr Felder".
      await expect(dialog.getByTestId('more-fields-summary')).toContainText('Heute');
      // The amount field has the focus: typing and Enter is all that is left.
      await page.keyboard.type('7,77');
      await page.keyboard.press('Enter');
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole('listitem').filter({ hasText: /7,77\s€/ })).toBeVisible();
    });
  });

  test.describe('phone', () => {
    test.use({
      viewport: PHONE,
      isMobile: true,
      hasTouch: true,
      seeded: { scale: 'small', preview: true },
    });
    test('the plus opens the sheet; its foot with "Speichern" stays on screen while the fields scroll', async ({
      page,
    }) => {
      await startSeeded(page, { phone: true });
      await openPage(page, '/finance');
      await page.getByTestId('bottom-plus').tap();
      const dialog = page.getByRole('dialog', { name: 'Buchung hinzufügen' });
      await expect(dialog).toBeVisible();
      expect(await visibleFields(page), 'visible fields of a new booking').toBe(3);
      // Every field open: the sheet is longer than the screen now.
      await dialog.getByRole('button', { name: 'Mehr Felder anzeigen' }).tap();
      await expect(dialog.getByLabel('Datum')).toBeVisible();
      // The date field shows the app's format and has its calendar button.
      await expect(dialog.getByLabel('Datum')).toHaveValue('29.09.2026');
      await expect(dialog.getByRole('button', { name: 'Kalender öffnen' })).toBeVisible();
      const foot = dialog.locator('[data-form-actions]');
      await expect(foot).toHaveCSS('position', 'sticky');
      const save = dialog.getByRole('button', { name: 'Speichern' });
      for (const top of [0, 9999]) {
        await dialog.evaluate((el, y) => el.scrollTo(0, y), top);
        const box = (await save.boundingBox())!;
        expect(box.y, `"Speichern" on screen at scroll ${top}`).toBeGreaterThan(0);
        expect(box.y + box.height, `"Speichern" on screen at scroll ${top}`).toBeLessThanOrEqual(
          PHONE.height,
        );
      }
    });
  });
});
