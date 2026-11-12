import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { measurePage, surfaceMetrics } from '../../scripts/lib/stimulusBudget';
import { test } from './helpers';
import { DESKTOP, openPage, PHONE, startSeeded } from './guards';

/**
 * The settings after package 0b-E, part E-1 of UI audit 2026-11 (the 15 tabs and the module settings; rules 1, 2 and
 * 5 of Identity 4.0): a tab's head is one title line (≤ 120 px on the desktop, ≤ 144 px on the phone), the quick
 * switches are on the start page only, surfaces are tone steps (no framed element and no shadow in `main`; the one
 * frame that stays is the danger zone, which is colour with meaning), a tab appears in one piece (layout shift
 * ≤ 0.05), and on the phone every control is at least 44 px to hit and the first section starts on the first screen.
 *
 * `SETTINGS_SHOTS=<dir>` also writes a full picture of every page in both themes (for the pull request).
 */
const TABS = [
  'einrichtung',
  'allgemein',
  'darstellung',
  'barrierefreiheit',
  'module',
  'werkzeuge',
  'benachrichtigungen',
  'sicherheit',
  'sync',
  'ki',
  'verbindungen',
  'schnellerfassung',
  'updates',
  'entwickler',
  'ueber',
] as const;
const PAGES = [
  ...TABS.map((t) => `/settings/${t}`),
  '/settings/module/finance',
  '/settings/module/planner',
  '/settings/module/todos',
];
const HEAD_MAX = { desktop: 120, phone: 144 } as const;
/**
 * The settings carry their own search field above the head on the phone (76 px), so 220 px + that field, + one more
 * line where the description under the title takes two.
 */
const SECTION_Y_PHONE = 320;
const SHIFT_MAX = 0.05;
/** "KI" still moves once while its local-model part reads its state (0.04–0.09, before 0.10): a follow-up. */
const SHIFT: Record<string, number> = { '/settings/ki': 0.1 };
/**
 * Frames that stay: the danger zone (`ui/SettingsParts` `DangerZone`, red with its words) and the file picker
 * "Datei wählen", which is a control drawn as a button (a `span`, so the count does not skip it like a `button`).
 */
const FRAMES: Record<string, number> = {
  '/settings/entwickler': 1,
  '/settings/ueber': 1,
  '/settings/sync': 1,
  '/settings/verbindungen': 1,
};
const SHOTS = process.env.SETTINGS_SHOTS;

interface Read {
  headHeight: number | null;
  h1: number;
  quickBar: boolean;
  /** Top of the first section heading or state card below the head (viewport px, page not scrolled). */
  sectionY: number | null;
  /** Controls smaller than 44 px in either direction that carry no hit strip. */
  small: string[];
  shift: number;
  sideways: boolean;
  /** The middle of the title answers as the title (no link's hit area lies over it). */
  titleFree: boolean;
}

/** Runs in the page. */
function read(): Read {
  const main = document.querySelector('main')!;
  const head = main.querySelector<HTMLElement>('[data-size="title"]');
  const shown = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const firstH2 = Array.from(main.querySelectorAll('h2, [data-status-card]')).filter(shown)[0];
  const bottomBar = document.querySelector('[data-bottom-bar]')?.getBoundingClientRect();
  const search = main.querySelector('[role="search"]')?.getBoundingClientRect();
  const free = { top: search ? search.bottom : 0, bottom: bottomBar ? bottomBar.top : innerHeight };
  const small: string[] = [];
  for (const el of Array.from(
    main.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, [role="switch"], [role="checkbox"], summary',
    ),
  )) {
    if (!shown(el)) continue;
    // The content of a closed fold still has a box (`content-visibility: hidden`), but it is not there to be hit.
    if (!el.checkVisibility()) continue;
    const r = el.getBoundingClientRect();
    if (r.width >= 44 && r.height >= 44) continue;
    // The options of the shared `Segmented` are 36 px with a strip that its scrolling track cuts on a narrow row:
    // design check F4, moved to the sweep 0b-8 (`ui/Patterns`), not this package's to change.
    if (el.matches('[role="group"] > button[aria-pressed]') && r.height >= 36) continue;
    // A hit strip (`::before`/`::after`) counts only where it can really be hit: the element must answer over at
    // least 42 px of height around it (a strip clipped by `overflow: hidden` or covered by a bar does not).
    const strip = (pseudo: string) => {
      const s = getComputedStyle(el, pseudo);
      return s.content !== 'none' && s.position === 'absolute';
    };
    if (strip('::after') || strip('::before')) {
      const x = r.left + Math.min(r.width / 2, 22);
      const mid = r.top + r.height / 2;
      let reach = 0;
      // Under the fixed bars (top bar and search above, bottom bar below) nothing can be hit at this scroll position.
      let outside = r.top - 24 < free.top || r.bottom + 24 > free.bottom;
      for (let y = mid - 44; y <= mid + 44; y += 2) {
        if (y < 0 || y > innerHeight) {
          outside = true; // not testable outside the window
          continue;
        }
        const at = document.elementFromPoint(x, y);
        if (at && (at === el || el.contains(at))) reach += 2;
      }
      // 42: the strip of the shared `Switch` is 42 px high (`ui/Fields`, not this package's to change).
      if (outside || reach >= 42) continue;
    }
    // A native box inside a label that is tall enough is hit through the label.
    const label = el.closest('label');
    if (label && label.getBoundingClientRect().height >= 44) continue;
    small.push(
      `${el.tagName.toLowerCase()} "${(el.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`,
    );
  }
  return {
    headHeight: head ? Math.round(head.getBoundingClientRect().height) : null,
    h1: main.querySelectorAll('h1').length,
    quickBar: !!main.querySelector('[data-testid="quick-bar"]'),
    sectionY: firstH2 ? Math.round(firstH2.getBoundingClientRect().top) : null,
    small,
    shift: (window as unknown as { __shift?: number }).__shift ?? 0,
    sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    titleFree: (() => {
      const h1 = main.querySelector('h1');
      if (!h1) return false;
      const b = h1.getBoundingClientRect();
      const at = document.elementFromPoint(b.left + 12, b.top + b.height / 2);
      return !!at && (at === h1 || h1.contains(at));
    })(),
  };
}

async function check(page: Page, phone: boolean, theme: string) {
  // Layout shift of each page since its load, without shifts that follow an input.
  await page.addInitScript(() => {
    const w = window as unknown as { __shift: number };
    w.__shift = 0;
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as {
          value: number;
          hadRecentInput: boolean;
        }[])
          if (!e.hadRecentInput) w.__shift += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      // No layout-shift entries in this browser: the count stays 0.
    }
  });
  await startSeeded(page, { phone });
  const seen: Record<string, unknown> = {};

  // The start page keeps its status head and is the one place of the quick switches.
  await openPage(page, '/settings');
  const bar = page.getByTestId('quick-bar');
  await expect(bar, 'the quick switches are on the start page').toBeVisible();
  await expect(bar.getByRole('heading', { level: 2 })).toHaveText('Schnell umschalten');

  for (const path of PAGES) {
    await openPage(page, path);
    // The Dev-Preview notice would lie over the picture.
    const notice = page.getByRole('button', { name: 'Schließen', exact: true });
    if (await notice.count()) await notice.first().click();
    // Lazy sections and live queries settle.
    await page.waitForTimeout(900);
    const r = await page.evaluate(read);
    const m = surfaceMetrics(await page.evaluate(measurePage));
    seen[path] = { head: r.headHeight, sectionY: r.sectionY, borders: m.borders, shift: r.shift };
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({
        path: join(
          SHOTS,
          `${phone ? 'phone' : 'desktop'}-${theme}-${path.slice(1).replace(/\//g, '-')}.png`,
        ),
        fullPage: phone,
      });
    }
    // Rule 2: one title line, one h1.
    expect.soft(r.headHeight, `${path}: the head is the title line`).not.toBeNull();
    expect
      .soft(r.headHeight ?? 9999, `${path}: head height`)
      .toBeLessThanOrEqual(phone ? HEAD_MAX.phone : HEAD_MAX.desktop);
    expect.soft(r.h1, `${path}: one h1`).toBe(1);
    expect.soft(r.titleFree, `${path}: nothing lies over the title`).toBe(true);
    expect.soft(r.quickBar, `${path}: no quick switches above a tab`).toBe(false);
    // Rule 1: tone steps.
    expect
      .soft(m.borders, `${path}: framed elements in main`)
      .toBeLessThanOrEqual(FRAMES[path] ?? 0);
    expect.soft(m.shadows, `${path}: shadows in main`).toBe(0);
    // The tab appears in one piece.
    expect.soft(r.shift, `${path}: layout shift`).toBeLessThanOrEqual(SHIFT[path] ?? SHIFT_MAX);
    expect.soft(r.sideways, `${path}: the page scrolls sideways`).toBe(false);
    if (phone) {
      expect.soft(r.small, `${path}: controls below 44 px`).toEqual([]);
      if (r.sectionY !== null)
        expect
          .soft(r.sectionY, `${path}: the first section starts at y ≤ ${SECTION_Y_PHONE} px`)
          .toBeLessThanOrEqual(SECTION_Y_PHONE);
    }
  }
  console.log(`settings ${phone ? 'phone' : 'desktop'} ${theme}`, JSON.stringify(seen));
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`settings on tone steps (Identity 4.0, package 0b-E), ${theme}`, () => {
    test.use({ colorScheme: theme });
    test.setTimeout(240_000);

    test.describe('desktop', () => {
      test.use({ viewport: DESKTOP, seeded: { scale: 'medium', desktop: true, preview: true } });
      test('tabs and module settings: title line, no frames, quick switches on the start page only', async ({
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
        seeded: { scale: 'medium', preview: true },
      });
      test('tabs and module settings: title line, 44 px targets, first section on the first screen', async ({
        page,
      }) => {
        await check(page, true, theme);
      });
    });
  });
}
