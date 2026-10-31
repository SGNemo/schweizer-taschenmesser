#!/usr/bin/env node
/**
 * Fast local gate: format, lint and typecheck at the same time, with caches.
 *
 *   npm run check
 *
 * Same checks as `format:check`, `lint` and `typecheck` (CI keeps running those uncached), but the
 * three run in parallel and the tools reuse their caches under node_modules/.cache, so a repeat run
 * after a small edit takes seconds. Output of every check is shown after all have finished.
 * The bundle budget (scripts/check-bundle.mjs) runs alongside as a warning only: it never fails the gate.
 * Skip it with CHECK_BUNDLE=0 (it builds the app into dist-bundle/, a few seconds).
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, 'node_modules', '.cache', 'check');
mkdirSync(cache, { recursive: true });

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const tsc = (project) => [
  'tsc',
  '-p',
  project,
  '--incremental',
  '--tsBuildInfoFile',
  join(cache, `${project}.tsbuildinfo`),
];

const checks = [
  {
    name: 'format',
    args: ['prettier', '--check', '.', '--cache', '--cache-location', join(cache, 'prettier')],
  },
  {
    name: 'lint',
    args: [
      'eslint',
      '.',
      '--cache',
      '--cache-location',
      join(cache, 'eslint'),
      '--cache-strategy',
      'content',
    ],
  },
  { name: 'typecheck app', args: tsc('tsconfig.app.json') },
  { name: 'typecheck sw', args: tsc('tsconfig.sw.json') },
  { name: 'typecheck node', args: tsc('tsconfig.node.json') },
  ...(process.env.CHECK_BUNDLE === '0'
    ? []
    : [{ name: 'bundle budget', node: ['scripts/check-bundle.mjs'], warnOnly: true }]),
];

function run({ name, args, node, warnOnly }) {
  const started = Date.now();
  return new Promise((done) => {
    const child = node
      ? spawn(process.execPath, node, { cwd: root })
      : spawn(npx, ['--no-install', ...args], { cwd: root, shell: process.platform === 'win32' });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', (e) =>
      done({ name, warnOnly, code: 1, out: String(e), ms: Date.now() - started }),
    );
    child.on('close', (code) =>
      done({ name, warnOnly, code: code ?? 1, out, ms: Date.now() - started }),
    );
  });
}

const begin = Date.now();
const results = await Promise.all(checks.map(run));
for (const r of results) {
  if (r.warnOnly) {
    // Warning only: show the budget table when something is over it (or the measurement broke).
    const warn = r.code !== 0 || /WARNING/.test(r.out);
    console.log(`${warn ? 'WARN' : 'ok  '} ${r.name} (${(r.ms / 1000).toFixed(1)} s)`);
    if (warn) console.log(r.out.slice(Math.max(0, r.out.indexOf('\nbudget '))).trim() + '\n');
    continue;
  }
  const ok = r.code === 0;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.name} (${(r.ms / 1000).toFixed(1)} s)`);
  if (!ok && r.out.trim()) console.log(r.out.trimEnd() + '\n');
}
const failed = results.filter((r) => !r.warnOnly && r.code !== 0).length;
console.log(
  `${failed === 0 ? 'All checks passed' : `${failed} check(s) failed`} in ${((Date.now() - begin) / 1000).toFixed(1)} s`,
);
process.exit(failed === 0 ? 0 : 1);
