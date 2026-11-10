import { expect, type Page } from '@playwright/test';
import { measurePage } from '../../scripts/lib/stimulusBudget';
import { test } from './helpers';
import { DESKTOP, moduleRoutes, openPage, PHONE, startSeeded } from './guards';

/**
 * The calm colour mode keeps colour for overdue (red) and today (accent) only (UI audit 2026-11, package 0b-1;
 * tokens.css `data-color='calm'`). Per module page, desktop and 412 px: `colouredAboveFold` of the stimulus
 * measurement (`measurePage`: coloured text + coloured surfaces above the fold, inside `main`) is at most the number
 * of danger and today elements above the fold.
 *
 * A danger or today element is counted the way the measurement counts colour, per element and per channel (its
 * text, its background): a hit of the measurement whose colour lies on the hue of `--danger` or of `--accent`, the
 * two colours the mode keeps. So the guard says: every coloured thing above the fold is red or accent. What it cannot
 * say is whether that red or accent is deserved (an accent that is not "today" is the business of the one-primary
 * guard and of the area packages).
 *
 * One named exception, `INK_MARKS`: the calendar fills the 6-px marks of reminders and of external calendars with
 * the text greys (`--text-3`, `--text-muted`; `calendar.module.css` `.lineMark`), in every colour mode. Those greys
 * have a blue cast the measurement reads as colour, and a token cannot reach them (package 0b-1 touches no module).
 * On the listed routes a fill in exactly one of the two greys on an element of at most 12 × 12 px is not counted;
 * everywhere else it is. The entry goes with the package that owns the page (calendar: 0b-4).
 *
 * What the guard cannot see is what the measurement cannot see: gradients and patterns (`background-image`: the
 * module head band), borders, pseudo-elements and SVG (icons, charts). That those turn grey is pinned at the
 * token level (`ui/tokens.test.ts`: every hue and state token is `--calm-ink` in calm, the patterns are off).
 *
 * Light theme only (the theme of the stimulus measurement): the dark neutral steps themselves are bluish
 * (`--surface`: saturation 0.28) and the measurement reads every tone that is not exactly `--bg`, `--surface` or
 * `--surface-2` as a coloured surface there, grey or not.
 */

/** Routes whose small marks in a text grey are not counted, with the package that removes the entry. */
const INK_MARKS: Record<string, string> = {
  '/calendar': '0b-4: `.lineMark` of reminders and external calendars (`--text-3`, `--text-muted`)',
};
/** Largest side (px) of an element that still is a mark. */
const MARK_MAX = 12;

/**
 * How far a colour may lie from the hue of `--danger` / `--accent` (degrees): mixes over a surface drift a little.
 * Narrow enough to keep amber out: the light `--warning` lies 19° from the accent.
 */
const HUE_BAND = 12;

interface Kept {
  /** Hits of the measurement on the danger or accent hue. */
  kept: number;
  /** Hits that are a small mark filled with `--text-3` or `--text-muted` (see `INK_MARKS`). */
  inkMarks: number;
  /** Every other hit: what the mode should have turned grey. */
  others: string[];
}

/** Runs in the page. The hit conditions are those of `measurePage` (kept in step by the sum check below). */
function keptColour({ band, markMax }: { band: number; markMax: number }): Kept {
  const scope = document.getElementById('main') ?? document.querySelector('main') ?? document.body;
  const fold = window.innerHeight;
  const rootStyle = getComputedStyle(document.documentElement);
  const probe = document.createElement('span');
  document.body.appendChild(probe);
  const rgb = (name: string) => {
    probe.style.color = '';
    probe.style.color = rootStyle.getPropertyValue(name).trim();
    return getComputedStyle(probe).color;
  };
  const plain = new Set([rgb('--bg'), rgb('--surface'), 'rgba(0, 0, 0, 0)', 'transparent']);
  const surface2 = rgb('--surface-2');
  const neutralInk = new Set(['--text', '--text-muted', '--text-3', '--text-on-tint'].map(rgb));
  const inkFills = new Set([rgb('--text-3'), rgb('--text-muted')]);
  const keptTokens = [rgb('--danger'), rgb('--accent')];
  probe.remove();
  const parse = (c: string) => {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c);
    if (m) return { r: +m[1]!, g: +m[2]!, b: +m[3]!, a: m[4] === undefined ? 1 : +m[4] };
    const k = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/.exec(c);
    return k
      ? {
          r: Math.round(+k[1]! * 255),
          g: Math.round(+k[2]! * 255),
          b: Math.round(+k[3]! * 255),
          a: k[4] === undefined ? 1 : +k[4],
        }
      : null;
  };
  const saturation = (c: string) => {
    const p = parse(c);
    if (!p || p.a < 0.05) return 0;
    const max = Math.max(p.r, p.g, p.b);
    return max === 0 ? 0 : (max - Math.min(p.r, p.g, p.b)) / max;
  };
  const hue = (c: string): number | null => {
    const p = parse(c);
    if (!p) return null;
    const max = Math.max(p.r, p.g, p.b);
    const d = max - Math.min(p.r, p.g, p.b);
    if (d === 0) return null;
    const h =
      max === p.r ? ((p.g - p.b) / d) % 6 : max === p.g ? (p.b - p.r) / d + 2 : (p.r - p.g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  const keptHues = keptTokens.map(hue).filter((h): h is number => h !== null);
  const isKept = (c: string) => {
    const h = hue(c);
    return (
      h !== null && keptHues.some((k) => Math.min(Math.abs(h - k), 360 - Math.abs(h - k)) <= band)
    );
  };
  const name = (el: Element) =>
    `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').split(' ')[0]?.replace(/_[a-z0-9]{5}_\d+$/, '')}`;
  let kept = 0;
  let inkMarks = 0;
  const others: string[] = [];
  for (const el of Array.from(scope.querySelectorAll('*'))) {
    if (el instanceof SVGElement) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity || 1) <= 0.05)
      continue;
    if (!(r.top < fold && r.bottom > 0)) continue;
    const ownText = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '',
    );
    if (ownText && saturation(s.color) > 0.25 && !neutralInk.has(s.color)) {
      if (isKept(s.color)) kept++;
      else others.push(`text ${name(el)} ${s.color}`);
    }
    const bg = parse(s.backgroundColor);
    if (
      !plain.has(s.backgroundColor) &&
      s.backgroundColor !== surface2 &&
      bg &&
      bg.a > 0.05 &&
      saturation(s.backgroundColor) > 0.12
    ) {
      if (isKept(s.backgroundColor)) kept++;
      else if (inkFills.has(s.backgroundColor) && r.width <= markMax && r.height <= markMax)
        inkMarks++;
      else others.push(`surface ${name(el)} ${s.backgroundColor}`);
    }
  }
  return { kept, inkMarks, others };
}

/** The measured value and the count of danger and today elements of the page that is open. */
async function count(page: Page) {
  const measured = await page.evaluate(measurePage);
  const found = await page.evaluate(keptColour, { band: HUE_BAND, markMax: MARK_MAX });
  return { colouredAboveFold: measured.colouredText + measured.colouredSurfaces, ...found };
}

const calm = (page: Page, on: boolean) =>
  page.evaluate((value) => {
    if (value) localStorage.setItem('tm-color', 'calm');
    else localStorage.removeItem('tm-color');
  }, on);

async function check(page: Page, phone: boolean) {
  await startSeeded(page, { phone });
  await calm(page, true);
  for (const path of moduleRoutes(phone)) {
    await openPage(page, path);
    expect(await page.evaluate(() => document.documentElement.dataset.color), path).toBe('calm');
    const now = await count(page);
    // The copy of the hit conditions above still counts what the measurement counts.
    expect
      .soft(now.kept + now.inkMarks + now.others.length, `${path}: hits of the guard`)
      .toBe(now.colouredAboveFold);
    const excused = path in INK_MARKS ? now.inkMarks : 0;
    const left = [
      ...now.others,
      ...(path in INK_MARKS || !now.inkMarks ? [] : [`${now.inkMarks} mark(s) in a text grey`]),
    ];
    expect
      .soft(
        now.colouredAboveFold - excused,
        `${path}: colour above the fold that is neither red nor accent: ${left.join(' | ')}`,
      )
      .toBeLessThanOrEqual(now.kept);
  }
}

test.describe('desktop', () => {
  test.use({ viewport: DESKTOP, seeded: { scale: 'small', desktop: true, preview: true } });

  test('calm: above the fold only overdue and today keep colour, on every module page', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await check(page, false);
  });

  test('the guard sees colour: with all colours on, pages known for theirs are over the limit', async ({
    page,
  }) => {
    // Without this a changed formula or a renamed token would let every page pass with nothing counted.
    await startSeeded(page);
    await calm(page, false);
    for (const path of ['/calendar', '/budgets', '/pantry']) {
      await openPage(page, path);
      const now = await count(page);
      expect(now.others.length, path).toBeGreaterThan(0);
      expect(now.colouredAboveFold - now.inkMarks, path).toBeGreaterThan(now.kept);
    }
  });

  test('the guard counts red and accent as kept: a page with an overdue row and a main action has both', async ({
    page,
  }) => {
    await startSeeded(page);
    await calm(page, true);
    await openPage(page, '/invoices');
    const now = await count(page);
    expect(now.kept).toBeGreaterThan(1);
  });
});

test.describe('phone', () => {
  test.use({
    viewport: PHONE,
    isMobile: true,
    hasTouch: true,
    seeded: { scale: 'small', preview: true },
  });

  test('calm: above the fold only overdue and today keep colour, on every module page', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await check(page, true);
  });
});
