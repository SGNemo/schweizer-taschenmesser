/**
 * Bundle report and budget: pure logic over Vite's build manifest (`dist/.vite/manifest.json`, written when
 * `VITE_BUNDLE_REPORT=1`), the file sizes and the service worker's precache list. No file access here, see
 * scripts/check-bundle.mjs. Recipe: docs/perf/COLD-START-2026-10.md.
 */

/** One entry of Vite's `manifest.json` (only the fields used here). */
export interface ManifestChunk {
  file: string;
  src?: string;
  name?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
}
export type ViteManifest = Record<string, ManifestChunk>;

/** Size of one emitted file: raw bytes and gzip bytes. */
export interface FileSize {
  bytes: number;
  gzip: number;
}
export type SizeOf = (file: string) => FileSize;

export interface PathFile extends FileSize {
  file: string;
}

export interface CriticalPath {
  entry: string;
  files: PathFile[];
  bytes: number;
  gzip: number;
  /** Requests on the critical path (JS + CSS files). */
  requests: number;
}

/**
 * The critical path of one entry: the entry chunk, every chunk it imports statically (transitively)
 * and their CSS. Dynamic imports are not followed: they load when the code asks for them.
 */
export function criticalPath(
  manifest: ViteManifest,
  entryKey: string,
  sizeOf: SizeOf,
): CriticalPath {
  const seen = new Set<string>();
  const files = new Set<string>();
  const stack = [entryKey];
  while (stack.length) {
    const key = stack.pop()!;
    if (seen.has(key)) continue;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk) continue;
    files.add(chunk.file);
    for (const css of chunk.css ?? []) files.add(css);
    for (const imp of chunk.imports ?? []) stack.push(imp);
  }
  const list = [...files]
    .map((file) => ({ file, ...sizeOf(file) }))
    .sort((a, b) => b.gzip - a.gzip);
  return {
    entry: entryKey,
    files: list,
    bytes: list.reduce((s, f) => s + f.bytes, 0),
    gzip: list.reduce((s, f) => s + f.gzip, 0),
    requests: list.length,
  };
}

/** Entry keys of the manifest (one per HTML page), sorted. */
export function entries(manifest: ViteManifest): string[] {
  return Object.keys(manifest)
    .filter((k) => manifest[k]?.isEntry)
    .sort();
}

/** Every emitted JS/CSS file that is on no entry's critical path (= loads later, on demand). */
export function lazyFiles(
  manifest: ViteManifest,
  critical: Iterable<string>,
  sizeOf: SizeOf,
): PathFile[] {
  const onPath = new Set(critical);
  const all = new Set<string>();
  for (const c of Object.values(manifest)) {
    all.add(c.file);
    for (const css of c.css ?? []) all.add(css);
  }
  return [...all]
    .filter((f) => !onPath.has(f) && /\.(js|css)$/.test(f))
    .map((file) => ({ file, ...sizeOf(file) }))
    .sort((a, b) => b.gzip - a.gzip);
}

/** URLs of the precache list that the build injected into the service worker (`self.__WB_MANIFEST`). */
export function precacheUrls(swSource: string): string[] {
  return [...swSource.matchAll(/"url":"([^"]+)"/g)].map((m) => m[1]!);
}

/** Source module of a manifest chunk, for readable tables (`src/tools/pdf/Tool.tsx`, `node_modules/...`). */
export function labelOf(manifest: ViteManifest, file: string): string {
  for (const [key, c] of Object.entries(manifest)) {
    if (c.file === file) return c.src ?? key;
  }
  return file;
}

// --- Budget ---------------------------------------------------------------------------------------

export interface Budget {
  version: 1;
  /** Allowed growth over each number before a warning, in percent. */
  tolerancePercent: number;
  /** Critical path of the main entry (`index.html`), gzip bytes. */
  criticalGzip: number;
  /** Requests on the main critical path. */
  criticalRequests: number;
  /** Files in the service worker's precache list. */
  precacheFiles: number;
  /** Raw bytes of all precached files. */
  precacheBytes: number;
}

export interface Measured {
  criticalGzip: number;
  criticalRequests: number;
  precacheFiles: number;
  precacheBytes: number;
}

export interface BudgetLine {
  metric: keyof Measured;
  budget: number;
  limit: number;
  measured: number;
  over: boolean;
}

export const BUDGET_METRICS: readonly (keyof Measured)[] = [
  'criticalGzip',
  'criticalRequests',
  'precacheFiles',
  'precacheBytes',
];

/** Compares the measured numbers with the budget (limit = budget + tolerance). */
export function compareBudget(budget: Budget, measured: Measured): BudgetLine[] {
  return BUDGET_METRICS.map((metric) => {
    const limit = Math.round(budget[metric] * (1 + budget.tolerancePercent / 100));
    return {
      metric,
      budget: budget[metric],
      limit,
      measured: measured[metric],
      over: measured[metric] > limit,
    };
  });
}

/** A new budget from today's numbers (keeps the tolerance of the old one). */
export function makeBudget(measured: Measured, tolerancePercent = 5): Budget {
  return { version: 1, tolerancePercent, ...measured };
}

/** Files of the precache list that must stay out of it (tools, chat, password dictionaries). */
export function forbiddenInPrecache(
  precache: readonly string[],
  lazyOnline: readonly string[],
): string[] {
  const out = new Set(lazyOnline);
  return precache.filter((u) => out.has(u));
}

// --- Formatting -----------------------------------------------------------------------------------

export const kb = (n: number): string => `${(n / 1024).toFixed(1)} KB`;

export function formatTable(rows: readonly (readonly string[])[]): string {
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => r[i]!.length)));
  return rows
    .map((r) =>
      r.map((c, i) => (i === 0 ? c.padEnd(widths[i]!) : c.padStart(widths[i]!))).join('  '),
    )
    .join('\n');
}

export function formatBudget(lines: readonly BudgetLine[]): string {
  const fmt = (m: keyof Measured, n: number) =>
    m === 'criticalGzip' || m === 'precacheBytes' ? kb(n) : String(n);
  return formatTable([
    ['budget', 'measured', 'limit', ''],
    ...lines.map((l) => [
      l.metric,
      fmt(l.metric, l.measured),
      fmt(l.metric, l.limit),
      l.over ? 'OVER' : 'ok',
    ]),
  ]);
}
