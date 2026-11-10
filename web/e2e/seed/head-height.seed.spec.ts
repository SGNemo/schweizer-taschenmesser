import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';
import { test } from './helpers';
import { DESKTOP, MODULE_IDS, moduleRoutes, openPage, PHONE, startSeeded } from './guards';

/**
 * The module head of Identity 4.0 (UI audit 2026-11, package 0b-2, rule 2): one title row with the page's tabs at its
 * lower edge. On every module page of the seeded app the head is at most 120 px high on the desktop (title row +
 * tabs) and at most 144 px on the phone (title row + the one module row + tabs); a stage head (the modules whose
 * manifest says `head: 'stage'`: weather, music) may be up to 320 px and stays above the fold. Nothing in the head
 * runs past its edge, and on the phone the head holds no button of its own: the plus in the bottom bar is the entry.
 *
 * The pages come from the manifests (`guards.ts`), so a new module is measured without an edit here. The height is
 * the head's own box (`[data-testid="module-frame"]`); the notice above it (a weather hint) is not part of the head.
 */
const STANDARD_DESKTOP = 120;
const STANDARD_PHONE = 144;
const STAGE = 320;

const MODULES = join(dirname(fileURLToPath(import.meta.url)), '../../src/modules');
/** The modules whose manifest declares the stage head. */
const STAGE_IDS = MODULE_IDS.filter((id) =>
  /\bhead:\s*'stage'/.test(readFileSync(join(MODULES, id, 'manifest.ts'), 'utf8')),
);

/** Optional: a folder for a picture of every first screen (`HEAD_SHOTS=<dir>`, used for the pull request). */
const SHOTS = process.env.HEAD_SHOTS;

interface Head {
  variant: string | null;
  height: number;
  /** Elements inside the head that reach past its box (wrapped or pushed out). */
  outside: string[];
  /** Buttons in the head (the phone's head has none; the tabs and the module row are navigation). */
  buttons: string[];
  scrollWidth: number;
  clientWidth: number;
  /** The head has its title row (without it the checks on the row would pass on nothing). */
  hasTitleRow: boolean;
  /** The h1 is cut off (its text is wider than its box). */
  titleCut: boolean;
  /** The figure's number is cut off or pushed out of the row. */
  valueCut: boolean;
  /** The figure's context line is shortened (its one line is clamped). */
  detailCut: boolean;
  /** The page put its views into the row of the tabs. */
  hasTabs: boolean;
  /** The frame keeps that row from the first paint (`identity.tabs` in the manifest). */
  holdsTabs: boolean;
}

/** Runs in the page. */
function readHead(): Head | null {
  const head = document.querySelector<HTMLElement>('[data-testid="module-frame"]');
  if (!head) return null;
  const box = head.getBoundingClientRect();
  const outside: string[] = [];
  for (const el of Array.from(head.querySelectorAll<HTMLElement>('*'))) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
    // A row that scrolls sideways (tabs, module row) holds entries beyond the edge on purpose.
    if (el.closest('nav') || el.parentElement?.closest('[data-slot="tabs"]')) continue;
    if (el.closest('[data-slot="backdrop"], [aria-hidden="true"]')) continue;
    if (r.bottom > box.bottom + 1 || r.right > box.right + 1 || r.left < box.left - 1)
      outside.push(`${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 30)}`);
  }
  const titleRow = head.querySelector('[data-testid="module-title-row"]');
  const buttons = Array.from(titleRow?.querySelectorAll<HTMLElement>('button, a[href]') ?? [])
    .filter((b) => b.getBoundingClientRect().width > 0)
    .map((b) => b.getAttribute('aria-label') ?? b.textContent ?? '');
  return {
    variant: head.getAttribute('data-head'),
    height: Math.round(box.height),
    outside,
    buttons,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    hasTitleRow: !!titleRow,
    titleCut: (() => {
      const h1 = head.querySelector('h1');
      return !!h1 && h1.scrollWidth > h1.clientWidth + 1;
    })(),
    valueCut: (() => {
      const figure = titleRow?.querySelector<HTMLElement>('[data-testid="module-figure"]');
      if (!figure || !figure.getBoundingClientRect().width) return false;
      const row = titleRow!.getBoundingClientRect();
      const f = figure.getBoundingClientRect();
      return (
        figure.scrollWidth > figure.clientWidth + 1 ||
        f.right > row.right + 1 ||
        f.left < row.left - 1
      );
    })(),
    detailCut: Array.from(
      titleRow?.querySelectorAll<HTMLElement>('[data-testid="module-figure"] span') ?? [],
    )
      // The context line is the clamped one (the label is hidden, the number never clamps).
      .filter((el) => getComputedStyle(el).webkitLineClamp === '1')
      .some((el) => el.scrollHeight > el.clientHeight + 2),
    hasTabs: (head.querySelector('[data-slot="tabs"]')?.childElementCount ?? 0) > 0,
    holdsTabs: head.querySelector('[data-slot="tabs"]')?.getAttribute('data-hold') === 'true',
  };
}

async function check(page: Page, phone: boolean, theme: string) {
  await startSeeded(page, { phone });
  const routes = moduleRoutes(phone);
  // Every module of this window is measured: the list comes from the manifests, never from a number in here.
  expect(routes.length).toBeGreaterThan(STAGE_IDS.length);
  const seen: Record<string, number> = {};
  for (const path of routes) {
    await openPage(page, path);
    const id = path.slice(1);
    const head = await page.evaluate(readHead);
    expect(head, `${path}: the page has a module head`).not.toBeNull();
    if (!head) continue;
    const stage = STAGE_IDS.includes(id);
    expect.soft(head.variant, `${path}: head variant`).toBe(stage ? 'stage' : 'standard');
    const limit = stage ? STAGE : phone ? STANDARD_PHONE : STANDARD_DESKTOP;
    expect.soft(head.height, `${path}: head height (limit ${limit} px)`).toBeLessThanOrEqual(limit);
    expect.soft(head.outside, `${path}: nothing in the head leaves its box`).toEqual([]);
    expect
      .soft(head.scrollWidth, `${path}: no sideways overflow`)
      .toBeLessThanOrEqual(head.clientWidth);
    if (phone)
      expect.soft(head.buttons, `${path}: the phone's title row holds no control`).toEqual([]);
    expect.soft(head.hasTitleRow, `${path}: the head has a title row`).toBe(true);
    // The title is the head's orientation: the figure beside it gives way first, the h1 is never cut.
    expect.soft(head.titleCut, `${path}: the h1 is cut off`).toBe(false);
    expect.soft(head.valueCut, `${path}: the figure's number is cut or leaves the row`).toBe(false);
    // The context line gives way only under pressure: on the wide desktop there is room, so it is whole there.
    if (!phone)
      expect
        .soft(head.detailCut, `${path}: the figure's context line is cut although there is room`)
        .toBe(false);
    // U01: the manifest says whether the entry page has views, so the row is there before the page's code is.
    expect
      .soft(head.holdsTabs, `${path}: \`identity.tabs\` in the manifest matches the page's views`)
      .toBe(head.hasTabs);
    seen[path] = head.height;
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({
        path: join(SHOTS, `${phone ? 'phone' : 'desktop'}-${theme}-${id}.png`),
        clip: phone
          ? { x: 0, y: 0, width: PHONE.width, height: 400 }
          : { x: 0, y: 0, width: DESKTOP.width, height: 420 },
      });
    }
  }
  // The numbers of this run, for the pull request text.
  console.log(`head heights ${phone ? 'phone' : 'desktop'}: ${JSON.stringify(seen)}`);
}

for (const theme of SHOTS ? (['light', 'dark'] as const) : (['light'] as const)) {
  test.describe(`module head: one title row with tabs (Identity 4.0), ${theme}`, () => {
    test.use({ colorScheme: theme });
    test.setTimeout(240_000);

    test.describe('desktop', () => {
      test.use({ viewport: DESKTOP, seeded: { scale: 'small', desktop: true, preview: true } });

      test(`every module head ≤ ${STANDARD_DESKTOP} px, a stage ≤ ${STAGE} px`, async ({
        page,
      }) => {
        await check(page, false, theme);
      });
    });

    test.describe('phone', () => {
      test.use({
        viewport: PHONE,
        isMobile: true,
        hasTouch: true,
        seeded: { scale: 'small', preview: true },
      });

      test(`every module head ≤ ${STANDARD_PHONE} px, a stage ≤ ${STAGE} px, no control in it`, async ({
        page,
      }) => {
        await check(page, true, theme);
      });
    });
  });
}
