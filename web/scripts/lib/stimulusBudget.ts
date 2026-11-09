/**
 * Stimulus budget (focus audit, UI audit 2026-11): the measurement of one page (`measurePage`, run in the
 * browser by `e2e/screenshots/stimulus.spec.ts`) and the pure comparison of a measured inventory
 * (`inventory.json`) with the committed budget `e2e/stimulus-budget.json`. No file access here, see
 * scripts/check-stimulus.mjs. Rules: docs/howto/ci.md. This file is ratchet-protected (scripts/ratchet.mjs).
 */

/** Budget key in the JSON file → key in the inventory row. */
export const METRICS = {
  height: 'scrollHeight',
  buttons: 'buttons',
  links: 'links',
  icons: 'icons',
  firstScreenActions: 'firstScreenActions',
  borders: 'borders',
  shadows: 'shadows',
  surfaceLanguages: 'surfaceLanguages',
  colouredAboveFold: 'colouredAboveFold',
  signatureBlocks: 'signatureBlocks',
} as const;
export type Metric = keyof typeof METRICS;
export type Values = Record<Metric, number>;

/**
 * Metrics with a fixed band instead of the relative tolerance of the budget file. Surfaces are counted
 * exactly; the fold moves with font metrics and the runner, so colour above it gets one element of slack.
 */
export const ABSOLUTE_TOLERANCE: Partial<Record<Metric, number>> = {
  borders: 0,
  shadows: 0,
  surfaceLanguages: 0,
  colouredAboveFold: 1,
  signatureBlocks: 0,
};

/** A framed signature block (`data-signature-block`) may be at most this large; frames inside it: `SignatureBlockRule`. */
export const SIGNATURE_BLOCK_MAX = { width: 480, height: 320 };

export interface Budget {
  version: 1;
  /** Allowed distance from the budget: relative (`percent`) or, for the page height only, absolute (`px`), whichever is larger. */
  tolerance: { percent: number; px: number };
  /** Key = `<viewport>--<page>`, e.g. `p412--home`. */
  pages: Record<string, Partial<Values>>;
}

export interface SignatureBlock {
  /** Value of `data-signature-block`. */
  id: string;
  width: number;
  height: number;
  /** Framed elements inside the block (its own frame is not counted). */
  framedInside: number;
}

export interface InventoryRow {
  vp: string;
  page: string;
  signatureBlockList?: SignatureBlock[];
  [key: string]: unknown;
}

export type ViolationKind =
  'over' | 'under' | 'missing-page' | 'new-page' | 'missing-metric' | 'signature-block';
export interface Violation {
  key: string;
  kind: ViolationKind;
  metric?: Metric;
  budget?: number;
  measured?: number;
  /** Smallest and largest value that pass. */
  min?: number;
  max?: number;
  detail?: string;
}
export interface Comparison {
  violations: Violation[];
}

export const DEFAULT_TOLERANCE = { percent: 10, px: 50 };

export const rowKey = (row: Pick<InventoryRow, 'vp' | 'page'>): string => `${row.vp}--${row.page}`;

/** Largest value that still passes. Counts grow by 10 % (at least one element), the height by 10 % or 50 px. */
export function limitFor(metric: Metric, budget: number, tol: Budget['tolerance']): number {
  const fixed = ABSOLUTE_TOLERANCE[metric];
  if (fixed !== undefined) return budget + fixed;
  const relative = Math.floor((budget * (100 + tol.percent)) / 100);
  if (metric === 'height') return Math.max(relative, budget + tol.px);
  return Math.max(relative, budget + 1);
}

/** The band around a budget value, the same distance down as up (never below zero). */
export function rangeFor(
  metric: Metric,
  budget: number,
  tol: Budget['tolerance'],
): { min: number; max: number } {
  const max = limitFor(metric, budget, tol);
  return { min: Math.max(0, budget - (max - budget)), max };
}

/** Number of surface languages on a page: frames and shadows (0–2). Tints and tone steps do not count. */
export const surfaceLanguages = (borders: number, shadows: number): number =>
  (borders > 0 ? 1 : 0) + (shadows > 0 ? 1 : 0);

function valuesOf(row: InventoryRow): Values {
  const out = {} as Values;
  for (const m of Object.keys(METRICS) as Metric[]) {
    const v = row[METRICS[m]];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`Inventory row ${rowKey(row)}: "${METRICS[m]}" is not a number`);
    }
    out[m] = v;
  }
  return out;
}

export function measuredPages(inventory: InventoryRow[]): Record<string, Values> {
  const pages: Record<string, Values> = {};
  for (const row of inventory) pages[rowKey(row)] = valuesOf(row);
  return pages;
}

/** Budget from a measurement; keys sorted so diffs stay small. */
export function makeBudget(inventory: InventoryRow[], tolerance = DEFAULT_TOLERANCE): Budget {
  const measured = measuredPages(inventory);
  const pages: Record<string, Values> = {};
  for (const key of Object.keys(measured).sort()) pages[key] = measured[key]!;
  return { version: 1, tolerance, pages };
}

/** Entry of `scripts/baselines/signature-blocks.json`. */
export interface SignatureBlockRule {
  /**
   * Framed elements one block may hold today (absent = none). Kept so that the state of today is written
   * down instead of excused; it only ever sinks (every change of an entry is a ratchet hit).
   */
  framedInside?: number;
}

/** What is wrong with the marked blocks of one page (size, frames inside, a value the list does not know). */
export function signatureBlockProblems(
  blocks: SignatureBlock[],
  known?: Readonly<Record<string, SignatureBlockRule>>,
): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    const rule = known?.[b.id];
    if (known && !rule)
      out.push(`"${b.id}" is not listed in scripts/baselines/signature-blocks.json`);
    if (b.width > SIGNATURE_BLOCK_MAX.width || b.height > SIGNATURE_BLOCK_MAX.height)
      out.push(
        `"${b.id}" is ${b.width} × ${b.height} px (at most ${SIGNATURE_BLOCK_MAX.width} × ${SIGNATURE_BLOCK_MAX.height})`,
      );
    const allowed = rule?.framedInside ?? 0;
    if (b.framedInside > allowed)
      out.push(
        `"${b.id}" has ${b.framedInside} framed element(s) inside${allowed ? ` (at most ${allowed})` : ''}`,
      );
  }
  return [...new Set(out)];
}

/**
 * Strict on both sides: a value above its band is over budget, a value below it means the budget must be
 * lowered. A page that is in the budget but was not measured, a measured page without a budget and a missing
 * metric key are violations too (none of them may drop out of the ratchet silently).
 */
export function compare(
  budget: Budget,
  inventory: InventoryRow[],
  opts: { signatureBlocks?: Readonly<Record<string, SignatureBlockRule>> } = {},
): Comparison {
  const measured = measuredPages(inventory);
  const violations: Violation[] = [];
  for (const [key, base] of Object.entries(budget.pages)) {
    const now = measured[key];
    if (!now) {
      violations.push({ key, kind: 'missing-page' });
      continue;
    }
    for (const metric of Object.keys(METRICS) as Metric[]) {
      const value = base[metric];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        violations.push({ key, kind: 'missing-metric', metric, measured: now[metric] });
        continue;
      }
      const { min, max } = rangeFor(metric, value, budget.tolerance);
      if (now[metric] > max || now[metric] < min) {
        violations.push({
          key,
          kind: now[metric] > max ? 'over' : 'under',
          metric,
          budget: value,
          measured: now[metric],
          min,
          max,
        });
      }
    }
  }
  for (const key of Object.keys(measured)) {
    if (!budget.pages[key]) violations.push({ key, kind: 'new-page' });
  }
  for (const row of inventory) {
    for (const detail of signatureBlockProblems(row.signatureBlockList ?? [], opts.signatureBlocks))
      violations.push({ key: rowKey(row), kind: 'signature-block', detail });
  }
  return { violations };
}

const LABEL: Record<Metric, string> = {
  height: 'page height (px)',
  buttons: 'buttons',
  links: 'links',
  icons: 'icons',
  firstScreenActions: 'actions on first screen',
  borders: 'framed elements',
  shadows: 'shadows',
  surfaceLanguages: 'surface languages (frames, shadows)',
  colouredAboveFold: 'coloured text and surfaces above the fold',
  signatureBlocks: 'signature blocks',
};

/** Readable report: `page · value · budget → measured`. */
export function formatReport(result: Comparison): string {
  const lines: string[] = [];
  const of = (kind: ViolationKind) => result.violations.filter((v) => v.kind === kind);
  const over = of('over');
  if (over.length) {
    lines.push(`${over.length} value(s) over budget (page · value · budget → measured):`);
    for (const v of over)
      lines.push(`  ${v.key} · ${LABEL[v.metric!]} · ${v.budget} → ${v.measured} (limit ${v.max})`);
  }
  const under = of('under');
  if (under.length) {
    lines.push(
      `${under.length} value(s) below their budget: lower the baseline (page · value · budget → measured):`,
    );
    for (const v of under)
      lines.push(
        `  ${v.key} · ${LABEL[v.metric!]} · ${v.budget} → ${v.measured} (at least ${v.min})`,
      );
  }
  for (const v of of('missing-page'))
    lines.push(
      `  ${v.key} is in the budget but was not measured (page removed, renamed, or it failed before the measurement)`,
    );
  for (const v of of('new-page'))
    lines.push(`  ${v.key} was measured but has no budget yet (add the values of the CI run)`);
  for (const v of of('missing-metric'))
    lines.push(`  ${v.key} has no budget for "${v.metric}" (measured ${v.measured})`);
  for (const v of of('signature-block')) lines.push(`  ${v.key} · signature block ${v.detail}`);
  if (!lines.length) lines.push('Stimulus budget: all pages within budget.');
  return lines.join('\n');
}

/** Job summary: the report and the measured values in the form of the budget file, ready to take over. */
export function summaryMarkdown(
  result: Comparison,
  inventory: InventoryRow[],
  budget: Budget,
): string {
  const measured = makeBudget(inventory, budget.tolerance);
  return [
    '### Stimulus budget',
    '',
    '```',
    formatReport(result),
    '```',
    '',
    '<details><summary>Measured values of this run (lower a budget by taking these numbers into <code>web/e2e/stimulus-budget.json</code>, never a local measurement)</summary>',
    '',
    '```json',
    JSON.stringify(measured, null, 2),
    '```',
    '',
    '</details>',
    '',
  ].join('\n');
}

/**
 * Measures the page it runs in. Self-contained on purpose: Playwright sends its source to the browser
 * (`page.evaluate(measurePage)`), so it may use nothing from outside its own body. Formulas as in the UI audit
 * (docs/design/ui-audit-2026-11/tools/audit-tour.spec.ts `measure()`):
 *   borders            elements of `main` with a visible solid frame on all four sides, at least 40 × 24 px,
 *                      no form control; the frame of an element marked `data-signature-block` is not counted,
 *                      everything inside it is
 *   shadows            elements of `main` (at least 40 × 24 px) with a blurred or offset `box-shadow` outside
 *                      `dialog`, `[role=menu]`, `[popover]` and toasts (`[role=status]`); rings do not count
 *                      (the audit tour split the segments at `),` and so read ring + shadow as a ring)
 *   colouredText       visible elements above the fold with own text in a saturated, non-neutral colour
 *   colouredSurfaces   visible elements above the fold with a saturated background (not `--surface-2`)
 *   signatureBlockList every element marked `data-signature-block`: size and framed elements inside
 */
export function measurePage(): {
  borders: number;
  shadows: number;
  colouredText: number;
  colouredSurfaces: number;
  signatureBlockList: SignatureBlock[];
} {
  const scope = document.getElementById('main') ?? document.querySelector('main') ?? document.body;
  const fold = window.innerHeight;
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity || 1) > 0.05;
  };
  const aboveFold = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.top < fold && r.bottom > 0;
  };
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
  probe.remove();
  const parse = (c: string) => {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c);
    if (m) return { r: +m[1]!, g: +m[2]!, b: +m[3]!, a: m[4] === undefined ? 1 : +m[4] };
    // Chromium serialises `color-mix()` results as `color(srgb r g b / a)` with channels from 0 to 1.
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
  const framed = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 24) return false;
    if (el.matches('input, select, textarea, button')) return false;
    const s = getComputedStyle(el);
    const w = s.borderTopWidth;
    if (!w || w === '0px' || s.borderTopStyle !== 'solid') return false;
    if (s.borderBottomWidth !== w || s.borderLeftWidth !== w || s.borderRightWidth !== w)
      return false;
    const colour = parse(s.borderTopColor);
    return !!colour && colour.a > 0.05;
  };
  const shadow = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 24) return false;
    const value = getComputedStyle(el).boxShadow;
    if (!value || /(^|\s)none$/.test(value)) return false;
    // Segments are separated by the commas outside of brackets (colours carry commas of their own).
    const segments: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < value.length; i++) {
      if (value[i] === '(') depth++;
      else if (value[i] === ')') depth--;
      else if (value[i] === ',' && depth === 0) {
        segments.push(value.slice(start, i));
        start = i + 1;
      }
    }
    segments.push(value.slice(start));
    // A ring: no offset and no blur (`0px 0px 0px n`, inset or not). One segment that is more makes it a shadow.
    if (segments.every((seg) => /(^|\s)0px 0px 0px \d+(\.\d+)?px/.test(seg))) return false;
    return !el.closest('dialog, [role="menu"], [popover], [role="status"]');
  };

  let borders = 0;
  let shadows = 0;
  let colouredText = 0;
  let colouredSurfaces = 0;
  for (const el of Array.from(scope.querySelectorAll('*'))) {
    if (el instanceof SVGElement || !visible(el)) continue;
    if (!el.hasAttribute('data-signature-block') && framed(el)) borders++;
    if (shadow(el)) shadows++;
    if (!aboveFold(el)) continue;
    const s = getComputedStyle(el);
    const ownText = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '',
    );
    if (ownText && saturation(s.color) > 0.25 && !neutralInk.has(s.color)) colouredText++;
    const bg = parse(s.backgroundColor);
    if (
      !plain.has(s.backgroundColor) &&
      s.backgroundColor !== surface2 &&
      bg &&
      bg.a > 0.05 &&
      saturation(s.backgroundColor) > 0.12
    )
      colouredSurfaces++;
  }
  const signatureBlockList = Array.from(document.querySelectorAll('[data-signature-block]'))
    .filter(visible)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        id: el.getAttribute('data-signature-block') ?? '',
        width: Math.round(r.width),
        height: Math.round(r.height),
        framedInside: Array.from(el.querySelectorAll('*')).filter(
          (d) => !(d instanceof SVGElement) && visible(d) && framed(d),
        ).length,
      };
    });
  return { borders, shadows, colouredText, colouredSurfaces, signatureBlockList };
}

/** The metric values a row gets from `measurePage()`. */
export function surfaceMetrics(m: ReturnType<typeof measurePage>) {
  return {
    borders: m.borders,
    shadows: m.shadows,
    surfaceLanguages: surfaceLanguages(m.borders, m.shadows),
    colouredText: m.colouredText,
    colouredSurfaces: m.colouredSurfaces,
    colouredAboveFold: m.colouredText + m.colouredSurfaces,
    signatureBlocks: m.signatureBlockList.length,
    signatureBlockList: m.signatureBlockList,
  };
}
