#!/usr/bin/env node
/**
 * Bundle report and budget (warnings only). Builds the production app into `dist-bundle/` with
 * `VITE_BUNDLE_REPORT=1` (Vite manifest + per-chunk module list), then prints per entry the critical path
 * (entry + static imports, gzip via node:zlib) and the largest lazy chunks, the precache list of the service
 * worker, and compares the numbers with scripts/bundle-budget.json. Pure logic: scripts/lib/bundleReport.ts.
 *
 *   npm run check:bundle                     build + report + budget (exit 0 even when over budget)
 *   npm run check:bundle -- --no-build       report on the existing dist-bundle/
 *   npm run check:bundle -- --baseline       build + rewrite the budget (PRs that change the numbers on purpose)
 *   npm run check:bundle -- --modules        also list the largest modules on the main critical path
 *   node scripts/check-bundle.mjs --build-only   only the build (used by playwright.coldstart.config.ts)
 *   node scripts/check-bundle.mjs --dir dist     report on another build folder (needs VITE_BUNDLE_REPORT=1)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  compareBudget,
  criticalPath,
  entries,
  forbiddenInPrecache,
  formatBudget,
  formatTable,
  kb,
  labelOf,
  lazyFiles,
  makeBudget,
  precacheUrls,
} from './lib/bundleReport.ts';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const budgetPath = resolve(web, 'scripts/bundle-budget.json');
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const dirIdx = args.indexOf('--dir');
const outDir = resolve(web, dirIdx >= 0 ? (args[dirIdx + 1] ?? '') : 'dist-bundle');

if (!has('--no-build') && dirIdx < 0) {
  const run = spawnSync(
    'npx',
    ['vite', 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn'],
    {
      cwd: web,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, VITE_BUNDLE_REPORT: '1' },
    },
  );
  if (run.status !== 0) {
    console.error('Bundle build failed (see above); nothing measured.');
    process.exit(has('--build-only') ? 1 : 0);
  }
}
if (has('--build-only')) process.exit(0);

const manifestPath = join(outDir, '.vite/manifest.json');
if (!existsSync(manifestPath)) {
  console.error(
    `No ${manifestPath}: build with VITE_BUNDLE_REPORT=1 (npm run check:bundle does that).`,
  );
  process.exit(0);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const lazyOnlinePath = join(outDir, '.vite/lazy-online.json');
const lazyOnline = existsSync(lazyOnlinePath)
  ? JSON.parse(readFileSync(lazyOnlinePath, 'utf8'))
  : [];
const modulesPath = join(outDir, '.vite/modules.json');

const sizes = new Map();
const sizeOf = (file) => {
  let s = sizes.get(file);
  if (!s) {
    const buf = readFileSync(join(outDir, file));
    s = { bytes: buf.length, gzip: gzipSync(buf, { level: 9 }).length };
    sizes.set(file, s);
  }
  return s;
};

const paths = entries(manifest).map((e) => criticalPath(manifest, e, sizeOf));
console.log(
  'Critical path per entry (entry + static imports, what the first load needs before it runs)',
);
console.log(
  formatTable([
    ['entry', 'requests', 'raw', 'gzip'],
    ...paths.map((p) => [p.entry, String(p.requests), kb(p.bytes), kb(p.gzip)]),
  ]),
);
const main = paths.find((p) => p.entry === 'index.html') ?? paths[0];
if (!main) {
  console.error('No entry in the manifest.');
  process.exit(0);
}
console.log(`\nLargest files on the critical path of ${main.entry}`);
console.log(
  formatTable([
    ['file', 'raw', 'gzip'],
    ...main.files.slice(0, 15).map((f) => [f.file, kb(f.bytes), kb(f.gzip)]),
  ]),
);

const lazy = lazyFiles(
  manifest,
  paths.flatMap((p) => p.files.map((f) => f.file)),
  sizeOf,
);
const online = new Set(lazyOnline);
console.log(
  `\nLazy chunks (load on demand): ${lazy.length} files, ${kb(lazy.reduce((s, f) => s + f.gzip, 0))} gzip; largest`,
);
console.log(
  formatTable([
    ['file', 'source', 'gzip', 'precache'],
    ...lazy
      .slice(0, 15)
      .map((f) => [
        f.file,
        labelOf(manifest, f.file),
        kb(f.gzip),
        online.has(f.file) ? 'no' : 'yes',
      ]),
  ]),
);

if (has('--modules') && existsSync(modulesPath)) {
  const mods = JSON.parse(readFileSync(modulesPath, 'utf8'));
  const list = main.files.flatMap((f) => (mods[f.file] ?? []).map(([id, n]) => [id, n]));
  list.sort((a, b) => b[1] - a[1]);
  console.log('\nLargest modules on the main critical path (rendered size before minify/gzip)');
  console.log(
    formatTable([['module', 'size'], ...list.slice(0, 30).map(([id, n]) => [id, kb(n)])]),
  );
}

const swPath = join(outDir, 'sw.js');
const precache = existsSync(swPath) ? precacheUrls(readFileSync(swPath, 'utf8')) : [];
const precacheBytes = precache.reduce(
  (s, u) => s + (existsSync(join(outDir, u)) ? statSync(join(outDir, u)).size : 0),
  0,
);
console.log(
  `\nPrecache: ${precache.length} files, ${kb(precacheBytes)}; online on first use: ${lazyOnline.length} files`,
);
const leaked = forbiddenInPrecache(precache, lazyOnline);
if (leaked.length)
  console.warn(`WARNING: lazy-online chunks in the precache: ${leaked.join(', ')}`);

const measured = {
  criticalGzip: main.gzip,
  criticalRequests: main.requests,
  precacheFiles: precache.length,
  precacheBytes,
};
if (has('--baseline')) {
  const old = existsSync(budgetPath) ? JSON.parse(readFileSync(budgetPath, 'utf8')) : undefined;
  writeFileSync(
    budgetPath,
    `${JSON.stringify(makeBudget(measured, old?.tolerancePercent), null, 2)}\n`,
  );
  console.log('\nBundle budget written → scripts/bundle-budget.json');
  process.exit(0);
}
if (!existsSync(budgetPath)) {
  console.log('\nNo budget yet: npm run check:bundle -- --baseline');
  process.exit(0);
}
const lines = compareBudget(JSON.parse(readFileSync(budgetPath, 'utf8')), measured);
console.log(`\n${formatBudget(lines)}`);
if (lines.some((l) => l.over) || leaked.length) {
  console.warn(
    '\nWARNING: over the bundle budget (warning only). Intended? Run `npm run check:bundle -- --baseline` and commit scripts/bundle-budget.json (say why in the PR).',
  );
}
