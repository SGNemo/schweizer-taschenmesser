import { expect, type Page } from '@playwright/test';
import { cdpOf, mainAction, measure, median, probe, settle } from '../perf/clickProbe';
import { PHONE, startSeeded } from './guards';
import { test } from './helpers';

/**
 * Click to content guard (UI audit 2026-11, package 0b-8 step 3; how it is measured and why these targets:
 * docs/perf/CLICK-TO-CONTENT-2026-11.md). Seeded Dev-Preview build (`medium`), CPU slowed 4× through CDP, each
 * target RUNS times, the median of `done` (last change or database answer before 600 ms of quiet, no loading state)
 * against its budget × MARGIN.
 *
 * Targets (agreed 2026-11-13): a page is done within 1.0 s on the first visit and 0.5 s on the second; an entry
 * dialog within 0.3 s. `CEILING` holds the pages that are slower today, at their measured value: lower an entry when a
 * fix lands, remove it once the page meets the target; never raise one (that is a ratchet hit for the maintainer).
 * MARGIN absorbs CI load: runners are shared, and single runs move by ±0.3 s.
 */
const RUNS = 3;
const RATE = 4;
const MARGIN = 1.5;
const TARGET = { first: 1000, second: 500, dialog: 300 } as const;

/** Slower than the target today (ms, 4×, `develop` 4f1706d 2026-11-14, median of 5; the larger of desktop and phone). */
const CEILING: Readonly<Record<string, Partial<Record<'first' | 'second' | 'dialog', number>>>> = {
  overview: { first: 1050, second: 900 },
  settings: { second: 900 },
  calendar: { first: 900, second: 650 },
  // After the charts without Recharts (#863): `measure:click` 2026-11-14, median of 5, larger of desktop and phone.
  // The entry dialog meets its target (0.1–0.2 s). The 2nd visit reaches 0.5 s once shared queries stay
  // (`fix/perf-keep-shared-queries`); then this entry goes.
  finance: { first: 1150, second: 750 },
};

const budget = (id: string, kind: 'first' | 'second' | 'dialog') =>
  Math.round((CEILING[id]?.[kind] ?? TARGET[kind]) * MARGIN);

/** Page targets: the path, and where the click starts (the overview is reached from a module). */
const PAGES = [
  { id: 'overview', path: '/', start: '/todos' },
  { id: 'settings', path: '/settings', start: '/' },
  { id: 'library', path: '/library', start: '/' },
  { id: 'todos', path: '/todos', start: '/' },
  { id: 'calendar', path: '/calendar', start: '/' },
  { id: 'finance', path: '/finance', start: '/' },
  // Desktop only (`platforms: ['desktop']`); within the targets at 4× (0.7 / 0.4 s, docs/perf/FINANCE-MAIL-2026-11.md).
  { id: 'mail', path: '/mail', start: '/', desktopOnly: true },
] as const;
/** Entry dialogs behind the page's main action. */
const DIALOGS = ['todos', 'finance'] as const;

async function backTo(page: Page, path: string) {
  await page.evaluate((p) => {
    history.pushState({}, '', p);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await settle(page);
}

function guard(phone: boolean) {
  test.setTimeout(12 * 60_000);
  test('pages and entry dialogs are done in time (median, CPU 4×)', async ({ page }) => {
    await page.addInitScript(probe);
    await startSeeded(page, { phone });
    const cdp = await cdpOf(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
    const found: string[] = [];

    for (const t of PAGES) {
      if (phone && 'desktopOnly' in t) continue;
      const first: number[] = [];
      const second: number[] = [];
      for (let r = 0; r < RUNS; r++) {
        await page.goto(t.start);
        await settle(page);
        first.push((await measure(page, cdp, 'nav', t.path)).done);
        await backTo(page, t.start);
        second.push((await measure(page, cdp, 'nav', t.path)).done);
      }
      for (const [kind, xs] of [
        ['first', first],
        ['second', second],
      ] as const) {
        const m = median(xs);
        if (m > budget(t.id, kind))
          found.push(`${t.id} ${kind}: ${m} ms > ${budget(t.id, kind)} (${xs.join(', ')})`);
      }
    }

    for (const id of DIALOGS) {
      const xs: number[] = [];
      for (let r = 0; r < RUNS; r++) {
        await page.goto(`/${id}`);
        await settle(page);
        const action = await mainAction(page);
        expect(action, `${id}: main action`).not.toBeNull();
        await action!.evaluate((el) => el.setAttribute('data-ctc', 'go'));
        xs.push((await measure(page, cdp, 'click', 'go')).done);
        await expect(page.getByRole('dialog'), `${id}: entry dialog`).toBeVisible();
      }
      const m = median(xs);
      const key = `${id}+`;
      if (m > budget(key, 'dialog'))
        found.push(`${key}: ${m} ms > ${budget(key, 'dialog')} (${xs.join(', ')})`);
    }

    expect(found, 'click to content over budget').toEqual([]);
  });
}

test.describe('click to content – desktop', () => {
  test.use({
    viewport: { width: 1920, height: 1080 },
    seeded: { scale: 'medium', desktop: true, preview: true },
  });
  guard(false);
});

test.describe('click to content – phone', () => {
  test.use({
    viewport: PHONE,
    isMobile: true,
    hasTouch: true,
    seeded: { scale: 'medium', preview: true },
  });
  guard(true);
});
