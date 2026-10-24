/**
 * Stimulus budget (focus audit): pure comparison of a measured inventory (`e2e/screenshots/stimulus.spec.ts`,
 * `inventory.json`) with the committed budget `e2e/stimulus-budget.json`. No file access here, see
 * scripts/check-stimulus.mjs. Rules: docs/howto/ci.md.
 */

/** Budget key in the JSON file → key in the inventory row. */
export const METRICS = {
  height: 'scrollHeight',
  buttons: 'buttons',
  links: 'links',
  icons: 'icons',
  firstScreenActions: 'firstScreenActions',
} as const;
export type Metric = keyof typeof METRICS;
export type Values = Record<Metric, number>;

export interface Budget {
  version: 1;
  /** Allowed growth over the budget: relative (`percent`) or, for the page height only, absolute (`px`), whichever is larger. */
  tolerance: { percent: number; px: number };
  /** Key = `<viewport>--<page>`, e.g. `phone--home`. */
  pages: Record<string, Values>;
}

export interface InventoryRow {
  vp: string;
  page: string;
  [key: string]: unknown;
}

export interface Violation {
  key: string;
  metric: Metric;
  budget: number;
  measured: number;
  limit: number;
}
export interface Note {
  key: string;
  kind: 'missing' | 'new';
}
export interface Comparison {
  violations: Violation[];
  notes: Note[];
}

export const DEFAULT_TOLERANCE = { percent: 10, px: 50 };

export const rowKey = (row: Pick<InventoryRow, 'vp' | 'page'>): string => `${row.vp}--${row.page}`;

/** Largest value that still passes. Counts grow by 10 % (at least one element), the height by 10 % or 50 px. */
export function limitFor(metric: Metric, budget: number, tol: Budget['tolerance']): number {
  const relative = Math.floor((budget * (100 + tol.percent)) / 100);
  if (metric === 'height') return Math.max(relative, budget + tol.px);
  return Math.max(relative, budget + 1);
}

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

/** Budget from a fresh measurement (`npm run stimulus:baseline`); keys sorted so diffs stay small. */
export function makeBudget(inventory: InventoryRow[], tolerance = DEFAULT_TOLERANCE): Budget {
  const measured = measuredPages(inventory);
  const pages: Record<string, Values> = {};
  for (const key of Object.keys(measured).sort()) pages[key] = measured[key];
  return { version: 1, tolerance, pages };
}

export function compare(budget: Budget, inventory: InventoryRow[]): Comparison {
  const measured = measuredPages(inventory);
  const violations: Violation[] = [];
  const notes: Note[] = [];
  for (const [key, base] of Object.entries(budget.pages)) {
    const now = measured[key];
    if (!now) {
      notes.push({ key, kind: 'missing' });
      continue;
    }
    for (const metric of Object.keys(METRICS) as Metric[]) {
      const limit = limitFor(metric, base[metric], budget.tolerance);
      if (now[metric] > limit) {
        violations.push({ key, metric, budget: base[metric], measured: now[metric], limit });
      }
    }
  }
  for (const key of Object.keys(measured)) {
    if (!budget.pages[key]) notes.push({ key, kind: 'new' });
  }
  return { violations, notes };
}

const LABEL: Record<Metric, string> = {
  height: 'page height (px)',
  buttons: 'buttons',
  links: 'links',
  icons: 'icons',
  firstScreenActions: 'actions on first screen',
};

/** Readable report: `page · value · budget → measured`. */
export function formatReport(result: Comparison): string {
  const lines: string[] = [];
  if (result.violations.length) {
    lines.push(
      `${result.violations.length} value(s) over budget (page · value · budget → measured):`,
    );
    for (const v of result.violations) {
      lines.push(
        `  ${v.key} · ${LABEL[v.metric]} · ${v.budget} → ${v.measured} (limit ${v.limit})`,
      );
    }
  }
  for (const n of result.notes) {
    lines.push(
      n.kind === 'missing'
        ? `  note: ${n.key} is in the budget but was not measured (page removed or renamed? then run npm run stimulus:baseline)`
        : `  note: ${n.key} was measured but has no budget yet (run npm run stimulus:baseline to add it)`,
    );
  }
  if (!lines.length) lines.push('Stimulus budget: all pages within budget.');
  return lines.join('\n');
}
