import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Shared by the baselines that only shrink (`maxWidth`, `groupedList`, `ownH1`; UI audit 2026-11, package
 * 0a-1b): which files are counted and how the count is held against `scripts/baselines/<name>.json`.
 * Strict on both sides like `KNOWN_STRIPES` in `src/ui/noStripes.test.ts`: more than the file says is a new
 * hit, fewer means the file must be lowered in the same change. The ratchet (scripts/ratchet.mjs)
 * compares the file with the merge base on top: a raised number or a new key needs an approval.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
export const SRC = resolve(HERE, '../../src');
export const MODULES = resolve(SRC, 'modules');

/** Files under `src/modules`, as posix paths relative to `src/`, sorted. */
export function moduleFiles(keep: (path: string) => boolean): string[] {
  return (readdirSync(MODULES, { recursive: true }) as string[])
    .map((f) => `modules/${f.split('\\').join('/')}`)
    .filter(keep)
    .sort();
}

/** A source file of a `routes` folder at any depth of a module (no tests). */
export const isRouteSource = (path: string): boolean =>
  /^modules\/.+\/routes\/.+\.tsx$/.test(path) &&
  !/\.test\.tsx$/.test(path) &&
  !path.includes('/__tests__/');

export const readSrc = (path: string): string => readFileSync(resolve(SRC, path), 'utf8');

export interface Baseline {
  version: number;
  what: string;
  total: number;
  files: Record<string, number>;
}

export const baselineFile = (name: string): string => resolve(HERE, '../baselines', `${name}.json`);
export const readBaseline = (name: string): Baseline =>
  JSON.parse(readFileSync(baselineFile(name), 'utf8')) as Baseline;

/** Hits per file, files without a hit left out. */
export function countPerFile(
  files: readonly string[],
  count: (source: string) => number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of files) {
    const n = count(readSrc(f));
    if (n > 0) out[f] = n;
  }
  return out;
}

export interface BaselineDiff {
  /** Files with more hits than the baseline allows (new or raised): `path: was → now`. */
  over: string[];
  /** Files with fewer hits than the baseline says: `path: was → now`. */
  under: string[];
}

export function diffBaseline(
  baseline: Record<string, number>,
  actual: Record<string, number>,
): BaselineDiff {
  const paths = [...new Set([...Object.keys(baseline), ...Object.keys(actual)])].sort();
  const line = (p: string) => `${p}: ${baseline[p] ?? 0} → ${actual[p] ?? 0}`;
  return {
    over: paths.filter((p) => (actual[p] ?? 0) > (baseline[p] ?? 0)).map(line),
    under: paths.filter((p) => (actual[p] ?? 0) < (baseline[p] ?? 0)).map(line),
  };
}

export const sum = (counts: Record<string, number>): number =>
  Object.values(counts).reduce((a, b) => a + b, 0);
