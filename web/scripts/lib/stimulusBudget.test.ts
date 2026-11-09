// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MODULE_PAGES, PAGES, VIEWPORTS } from '../../e2e/screenshots/stimulusPages';
import { routeSlug } from '../ratchet.mjs';
import {
  ABSOLUTE_TOLERANCE,
  compare,
  formatReport,
  limitFor,
  makeBudget,
  measurePage,
  METRICS,
  rangeFor,
  signatureBlockProblems,
  summaryMarkdown,
  surfaceLanguages,
  surfaceMetrics,
  type InventoryRow,
  type Metric,
} from './stimulusBudget';

const row = (vp: string, page: string, o: Partial<Record<string, number>> = {}): InventoryRow => ({
  vp,
  page,
  scrollHeight: 1000,
  buttons: 10,
  links: 20,
  icons: 30,
  firstScreenActions: 15,
  borders: 6,
  shadows: 2,
  surfaceLanguages: 2,
  colouredAboveFold: 5,
  signatureBlocks: 0,
  ...o,
});
const base = makeBudget([row('p412', 'home'), row('d1920', 'home')]);
const both = (o: Partial<Record<string, number>>) => [row('p412', 'home', o), row('d1920', 'home')];

describe('limitFor / rangeFor', () => {
  it('height: larger of ±10 % and ±50 px', () => {
    expect(limitFor('height', 1000, base.tolerance)).toBe(1100);
    expect(limitFor('height', 200, base.tolerance)).toBe(250);
    expect(rangeFor('height', 1000, base.tolerance)).toEqual({ min: 900, max: 1100 });
    expect(rangeFor('height', 200, base.tolerance)).toEqual({ min: 150, max: 250 });
  });
  it('counts: ±10 %, at least one element, never below zero', () => {
    expect(limitFor('buttons', 100, base.tolerance)).toBe(110);
    expect(limitFor('buttons', 3, base.tolerance)).toBe(4);
    expect(limitFor('icons', 0, base.tolerance)).toBe(1);
    expect(rangeFor('buttons', 100, base.tolerance)).toEqual({ min: 90, max: 110 });
    expect(rangeFor('icons', 0, base.tolerance)).toEqual({ min: 0, max: 1 });
  });
  it('surfaces are exact, colour above the fold has one element of slack', () => {
    expect(ABSOLUTE_TOLERANCE).toEqual({
      borders: 0,
      shadows: 0,
      surfaceLanguages: 0,
      colouredAboveFold: 1,
      signatureBlocks: 0,
    });
    for (const m of ['borders', 'shadows', 'surfaceLanguages', 'signatureBlocks'] as Metric[])
      expect(rangeFor(m, 7, { percent: 50, px: 500 })).toEqual({ min: 7, max: 7 });
    expect(rangeFor('colouredAboveFold', 7, { percent: 50, px: 500 })).toEqual({ min: 6, max: 8 });
  });
});

describe('compare (strict on both sides)', () => {
  it('same numbers: nothing to report', () => {
    const r = compare(base, both({}));
    expect(r).toEqual({ violations: [] });
    expect(formatReport(r)).toMatch(/within budget/);
  });
  it('at the limit passes, one over fails', () => {
    expect(compare(base, both({ scrollHeight: 1100, buttons: 11 })).violations).toEqual([]);
    expect(compare(base, both({ scrollHeight: 1101 })).violations).toEqual([
      {
        key: 'p412--home',
        kind: 'over',
        metric: 'height',
        budget: 1000,
        measured: 1101,
        min: 900,
        max: 1100,
      },
    ]);
  });
  it('a value below its band is red: the baseline must be lowered', () => {
    expect(compare(base, both({ buttons: 9, scrollHeight: 900 })).violations).toEqual([]);
    const r = compare(base, both({ buttons: 8, scrollHeight: 10 }));
    expect(r.violations.map((v) => [v.metric, v.kind, v.min])).toEqual([
      ['height', 'under', 900],
      ['buttons', 'under', 9],
    ]);
    expect(formatReport(r)).toContain('lower the baseline');
    expect(formatReport(r)).toContain('p412--home · buttons · 10 → 8 (at least 9)');
  });
  it.each([
    ['borders', { borders: 7 }, 'over'],
    ['borders', { borders: 5 }, 'under'],
    ['shadows', { shadows: 3 }, 'over'],
    ['shadows', { shadows: 1 }, 'under'],
    ['surfaceLanguages', { surfaceLanguages: 1 }, 'under'],
    ['signatureBlocks', { signatureBlocks: 1 }, 'over'],
    ['colouredAboveFold', { colouredAboveFold: 7 }, 'over'],
    ['colouredAboveFold', { colouredAboveFold: 3 }, 'under'],
  ] as const)('%s has no relative tolerance (%o → %s)', (metric, change, kind) => {
    expect(compare(base, both(change)).violations.map((v) => [v.metric, v.kind])).toEqual([
      [metric, kind],
    ]);
  });
  it('colour above the fold may differ by one', () => {
    expect(compare(base, both({ colouredAboveFold: 6 })).violations).toEqual([]);
    expect(compare(base, both({ colouredAboveFold: 4 })).violations).toEqual([]);
  });
  it('lists every exceeded value readably', () => {
    const r = compare(base, both({ links: 40, icons: 99 }));
    const text = formatReport(r);
    expect(text).toContain('p412--home · links · 20 → 40');
    expect(text).toContain('p412--home · icons · 30 → 99');
    expect(r.violations).toHaveLength(2);
  });
  it('a page in the budget that was not measured is red', () => {
    const r = compare(base, [row('p412', 'home')]);
    expect(r.violations).toEqual([{ key: 'd1920--home', kind: 'missing-page' }]);
    expect(formatReport(r)).toContain('not measured');
  });
  it('a measured page without a budget is red', () => {
    const r = compare(base, [...both({}), row('p412', 'todos', { buttons: 999 })]);
    expect(r.violations).toEqual([{ key: 'p412--todos', kind: 'new-page' }]);
    expect(formatReport(r)).toContain('has no budget yet');
  });
  it('a missing metric key in the budget is red, not a silent pass', () => {
    const { borders: _dropped, ...rest } = base.pages['p412--home']!;
    const r = compare({ ...base, pages: { ...base.pages, 'p412--home': rest } }, both({}));
    expect(r.violations).toEqual([
      { key: 'p412--home', kind: 'missing-metric', metric: 'borders', measured: 6 },
    ]);
    expect(formatReport(r)).toContain('has no budget for "borders"');
  });
  it('a row without a number is an error, not a silent pass', () => {
    expect(() => compare(base, [row('p412', 'home', { links: undefined })])).toThrow(/links/);
    expect(() => compare(base, [row('p412', 'home', { shadows: Number.NaN })])).toThrow(/shadows/);
  });
});

describe('makeBudget / summary', () => {
  it('keeps only the ratchet values, sorted by key', () => {
    const b = makeBudget([row('p412', 'home', { badgeLike: 5 }), row('d1920', 'calendar')]);
    expect(Object.keys(b.pages)).toEqual(['d1920--calendar', 'p412--home']);
    expect(Object.keys(b.pages['p412--home']!)).toEqual(Object.keys(METRICS));
  });
  it('the job summary carries the measured values in budget form', () => {
    const inventory = both({ buttons: 8 });
    const text = summaryMarkdown(compare(base, inventory), inventory, base);
    expect(text).toContain('lower the baseline');
    const measured = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(text)![1]!);
    expect(measured.pages['p412--home'].buttons).toBe(8);
    expect(measured.tolerance).toEqual(base.tolerance);
  });
});

// ---------------------------------------------------------------------------------------------------------
// measurePage(): one fixture per formula. jsdom has no layout, so the fixtures carry their boxes.
// ---------------------------------------------------------------------------------------------------------

const FRAME = 'border: 1px solid rgb(120, 120, 120);';
const box = (w: number, h: number, top = 0) => `data-box="${top},${w},${h}"`;
function mount(html: string) {
  document.body.innerHTML = `<main id="main">${html}</main>`;
  return measurePage();
}
beforeAll(() => {
  Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true });
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const [top, width, height] = (this.getAttribute('data-box') ?? '0,0,0').split(',').map(Number);
    return {
      x: 0,
      y: top,
      left: 0,
      top,
      width,
      height,
      right: width,
      bottom: top! + height!,
      toJSON: () => ({}),
    } as DOMRect;
  };
  const root = document.documentElement.style;
  root.setProperty('--bg', 'rgb(250, 250, 250)');
  root.setProperty('--surface', 'rgb(255, 255, 255)');
  root.setProperty('--surface-2', 'rgb(240, 242, 245)');
  root.setProperty('--text', 'rgb(20, 20, 20)');
  root.setProperty('--text-muted', 'rgb(90, 90, 90)');
  root.setProperty('--text-3', 'rgb(120, 120, 120)');
  root.setProperty('--text-on-tint', 'rgb(10, 30, 60)');
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('measurePage: borders', () => {
  it('counts a visible frame on all four sides of an element of at least 40 × 24 px', () => {
    expect(mount(`<div ${box(200, 80)} style="${FRAME}">a</div>`).borders).toBe(1);
  });
  it.each([
    ['three sides', `<div ${box(200, 80)} style="${FRAME} border-bottom-width: 0;">a</div>`],
    ['one side', `<div ${box(200, 80)} style="border-left: 3px solid rgb(200, 0, 0);">a</div>`],
    ['uneven widths', `<div ${box(200, 80)} style="${FRAME} border-left-width: 4px;">a</div>`],
    ['dashed', `<div ${box(200, 80)} style="border: 1px dashed rgb(120, 120, 120);">a</div>`],
    [
      'transparent frame',
      `<div ${box(200, 80)} style="border: 1px solid rgba(0, 0, 0, 0);">a</div>`,
    ],
    [
      'too small',
      `<div ${box(39, 80)} style="${FRAME}">a</div><div ${box(80, 23)} style="${FRAME}">a</div>`,
    ],
    [
      'a form control',
      `<button ${box(200, 80)} style="${FRAME}">a</button><input ${box(200, 80)} style="${FRAME}">`,
    ],
    ['hidden', `<div ${box(200, 80)} style="${FRAME} visibility: hidden;">a</div>`],
    ['not laid out', `<div style="${FRAME}">a</div>`],
  ])('does not count: %s', (_name, html) => {
    expect(mount(html).borders).toBe(0);
  });
  it('leaves out only the frame of the marked element itself; what is inside counts', () => {
    const m = mount(
      `<li data-signature-block="vault-doc" ${box(300, 120)} style="${FRAME}">
         <span ${box(100, 40)} style="${FRAME}">framed inside</span>
       </li>
       <div ${box(200, 80)} style="${FRAME}">card</div>`,
    );
    expect(m.borders).toBe(2);
    expect(m.signatureBlockList).toEqual([
      { id: 'vault-doc', width: 300, height: 120, framedInside: 1 },
    ]);
  });
  it('only counts inside main', () => {
    document.body.innerHTML = `<nav><div ${box(200, 80)} style="${FRAME}">nav</div></nav><main id="main"></main>`;
    expect(measurePage().borders).toBe(0);
  });
});

describe('measurePage: shadows', () => {
  const shadow = (value: string, attrs = '') =>
    `<div ${box(200, 80)} ${attrs} style="box-shadow: ${value};">a</div>`;
  it('counts a blurred or offset shadow', () => {
    expect(mount(shadow('rgba(0, 0, 0, 0.2) 0px 2px 8px 0px')).shadows).toBe(1);
    expect(mount(shadow('rgba(0, 0, 0, 0.2) 0px 1px 0px 0px')).shadows).toBe(1);
    expect(
      mount(shadow('rgb(0, 0, 0) 0px 0px 0px 2px, rgba(0, 0, 0, 0.2) 0px 4px 12px 0px')).shadows,
    ).toBe(1);
  });
  it('a ring is not a shadow', () => {
    expect(mount(shadow('rgb(0, 90, 200) 0px 0px 0px 2px')).shadows).toBe(0);
    expect(
      mount(shadow('rgb(255, 255, 255) 0px 0px 0px 2px, rgb(0, 90, 200) 0px 0px 0px 4px inset'))
        .shadows,
    ).toBe(0);
    expect(mount(shadow('none')).shadows).toBe(0);
  });
  it.each(['<dialog open>', '<div role="menu">', '<div popover>', '<div role="status">'])(
    'floating things do not count: %s',
    (open) => {
      const close = open.startsWith('<dialog') ? '</dialog>' : '</div>';
      expect(mount(`${open}${shadow('rgba(0, 0, 0, 0.2) 0px 2px 8px 0px')}${close}`).shadows).toBe(
        0,
      );
    },
  );
  it('too small or hidden does not count', () => {
    expect(
      mount(`<div ${box(30, 20)} style="box-shadow: rgba(0, 0, 0, 0.2) 0px 2px 8px 0px;">a</div>`)
        .shadows,
    ).toBe(0);
    expect(
      mount(
        `<div ${box(200, 80)} style="display: none; box-shadow: rgba(0, 0, 0, 0.2) 0px 2px 8px 0px;">a</div>`,
      ).shadows,
    ).toBe(0);
  });
});

describe('measurePage: colour above the fold', () => {
  it('counts saturated text and saturated surfaces above the fold', () => {
    const m = mount(
      `<p ${box(200, 20, 100)} style="color: rgb(200, 30, 30);">überfällig</p>
       <div ${box(200, 80, 200)} style="background-color: rgb(210, 230, 255);"><span ${box(50, 20, 210)} style="color: rgb(20, 20, 20);">getönt</span></div>`,
    );
    expect([m.colouredText, m.colouredSurfaces]).toEqual([1, 1]);
    expect(surfaceMetrics(m).colouredAboveFold).toBe(2);
  });
  it.each([
    ['neutral ink', `<p ${box(200, 20, 10)} style="color: rgb(90, 90, 90);">a</p>`],
    ['the tint ink token', `<p ${box(200, 20, 10)} style="color: rgb(10, 30, 60);">a</p>`],
    ['below the fold', `<p ${box(200, 20, 1200)} style="color: rgb(200, 30, 30);">a</p>`],
    [
      'colour without own text',
      `<p ${box(200, 20, 10)} style="color: rgb(200, 30, 30);"><span ${box(50, 20, 10)} style="color: rgb(20, 20, 20);">a</span></p>`,
    ],
    [
      '--surface-2 and plain surfaces',
      `<div ${box(200, 80, 10)} style="background-color: rgb(240, 242, 245);"></div><div ${box(200, 80, 10)} style="background-color: rgb(255, 255, 255);"></div>`,
    ],
    [
      'a nearly transparent tint',
      `<div ${box(200, 80, 10)} style="background-color: rgba(0, 90, 200, 0.03);"></div>`,
    ],
  ])('does not count: %s', (_name, html) => {
    const m = mount(html);
    expect([m.colouredText, m.colouredSurfaces]).toEqual([0, 0]);
  });
});

describe('surface languages and signature blocks', () => {
  it('surfaceLanguages = how many of frames and shadows a page uses', () => {
    expect(surfaceLanguages(0, 0)).toBe(0);
    expect(surfaceLanguages(12, 0)).toBe(1);
    expect(surfaceLanguages(0, 3)).toBe(1);
    expect(surfaceLanguages(12, 3)).toBe(2);
    const m = mount(`<div ${box(200, 80)} style="${FRAME}">a</div>`);
    expect(surfaceMetrics(m)).toMatchObject({
      borders: 1,
      shadows: 0,
      surfaceLanguages: 1,
      signatureBlocks: 0,
    });
  });
  it('signatureBlocks = number of marked elements; each within 480 × 320 px and without a frame inside', () => {
    const m = mount(
      `<li data-signature-block="pantry-label" ${box(220, 96)} style="${FRAME}">Mehl</li>
       <li data-signature-block="pantry-label" ${box(220, 96)} style="${FRAME}">Reis</li>`,
    );
    expect(surfaceMetrics(m).signatureBlocks).toBe(2);
    expect(signatureBlockProblems(m.signatureBlockList, { 'pantry-label': {} })).toEqual([]);
  });
  it('a mark moved from the block to its container is red', () => {
    // The mark wanders from the `.doc` rows to the list around them: one large element with framed rows inside.
    const m = mount(
      `<ul data-signature-block="vault-doc" ${box(900, 700)} style="${FRAME}">
         <li ${box(300, 120)} style="${FRAME}">Mietvertrag</li>
         <li ${box(300, 120)} style="${FRAME}">Police</li>
       </ul>`,
    );
    const inventory = [row('d1920', 'home', surfaceMetrics(m) as never), row('p412', 'home')];
    const withBlock = makeBudget(inventory);
    const r = compare(withBlock, inventory, { signatureBlocks: { 'vault-doc': {} } });
    expect(r.violations.map((v) => [v.key, v.kind, v.detail])).toEqual([
      ['d1920--home', 'signature-block', '"vault-doc" is 900 × 700 px (at most 480 × 320)'],
      ['d1920--home', 'signature-block', '"vault-doc" has 2 framed element(s) inside'],
    ]);
    expect(formatReport(r)).toContain('signature block "vault-doc" is 900 × 700 px');
  });
  it('a mark the list does not know is red', () => {
    expect(
      signatureBlockProblems([{ id: 'finance-card', width: 100, height: 100, framedInside: 0 }], {
        'vault-doc': {},
      }),
    ).toEqual(['"finance-card" is not listed in scripts/baselines/signature-blocks.json']);
  });
  it('frames inside a block are red beyond what the list writes down for it', () => {
    const label = { id: 'pantry-label', width: 388, height: 126 };
    const rules = { 'pantry-label': { framedInside: 1 } };
    expect(signatureBlockProblems([{ ...label, framedInside: 1 }], rules)).toEqual([]);
    expect(signatureBlockProblems([{ ...label, framedInside: 2 }], rules)).toEqual([
      '"pantry-label" has 2 framed element(s) inside (at most 1)',
    ]);
    expect(signatureBlockProblems([{ ...label, framedInside: 1 }])).toEqual([
      '"pantry-label" has 1 framed element(s) inside',
    ]);
  });
});

// ---------------------------------------------------------------------------------------------------------
// The committed files agree with the source.
// ---------------------------------------------------------------------------------------------------------

// (jsdom replaces the global URL, so the path is resolved from the string.)
const web = `${resolve(dirname(fileURLToPath(import.meta.url)), '../..')}/`;
const read = (path: string) => readFileSync(`${web}${path}`, 'utf8');
function sources(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(`${web}${dir}`, { withFileTypes: true })) {
    if (e.isDirectory()) sources(`${dir}/${e.name}`, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push(`${dir}/${e.name}`);
  }
  return out;
}

describe('pages of the inventory', () => {
  it('every parameter-free route of every module manifest is measured under its route name', () => {
    const names = MODULE_PAGES.map((p) => p.name);
    expect(names.length).toBeGreaterThan(25);
    expect(names).toEqual(
      expect.arrayContaining(['finance', 'vault', 'clock', 'disk', 'disk-scan']),
    );
    expect(names).not.toContain('example');
    expect(names.some((n) => n.includes(':') || n.includes('focus'))).toBe(false);
    // The ratchet recognises a new route by the same name (scripts/ratchet.mjs `routeSlug`).
    for (const p of MODULE_PAGES) expect(p.name).toBe(routeSlug(p.path));
  });
  it('platform-bound modules are measured on the desktop window only', () => {
    const bound = MODULE_PAGES.filter((p) => p.desktop);
    expect(bound.map((p) => p.name)).toEqual(expect.arrayContaining(['browser', 'disk', 'mail']));
    for (const p of MODULE_PAGES)
      expect(!!p.desktop, p.name).toBe(
        /\bplatforms:\s*\[/.test(read(`src/modules/${p.module}/manifest.ts`)),
      );
  });
  it('the budget holds exactly the measured pages, with every metric', () => {
    const budget = JSON.parse(read('e2e/stimulus-budget.json'));
    const expected = VIEWPORTS.flatMap((vp) =>
      PAGES.filter((p) => !vp.mobile || !p.desktop).map((p) => `${vp.name}--${p.name}`),
    ).sort();
    expect(Object.keys(budget.pages).sort()).toEqual(expected);
    expect(VIEWPORTS.map((v) => `${v.name} ${v.width}×${v.height}`)).toEqual([
      'd1920 1920×1080',
      'p412 412×915',
    ]);
    for (const [key, values] of Object.entries(budget.pages))
      expect(Object.keys(values as object), key).toEqual(Object.keys(METRICS));
  });
});

describe('signature-blocks.json', () => {
  it('lists exactly the values of `signatureBlock` in the source, each in the file it names', () => {
    const blocks = JSON.parse(read('scripts/baselines/signature-blocks.json')).blocks as Record<
      string,
      { source: string; page: string }
    >;
    const found: Record<string, string[]> = {};
    for (const file of sources('src'))
      for (const m of read(file).matchAll(
        /(?:signatureBlock|data-signature-block)=["']([^"']+)["']/g,
      ))
        (found[m[1]!] ??= []).push(file);
    expect(Object.keys(found).sort()).toEqual(Object.keys(blocks).sort());
    for (const [id, block] of Object.entries(blocks)) {
      expect(found[id], id).toEqual([block.source]);
      expect(PAGES.map((p) => p.name)).toContain(block.page);
    }
    // The attribute itself is written in one place only: the shared row.
    const writers = sources('src').filter((f) => /data-signature-block=\{/.test(read(f)));
    expect(writers).toEqual(['src/ui/Patterns.tsx']);
  });
});
