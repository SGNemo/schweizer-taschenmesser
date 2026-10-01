#!/usr/bin/env node
/**
 * Fast local gate: format, lint and typecheck at the same time, with caches.
 *
 *   npm run check
 *
 * Same checks as `format:check`, `lint` and `typecheck` (CI keeps running those uncached), but the
 * three run in parallel and the tools reuse their caches under node_modules/.cache, so a repeat run
 * after a small edit takes seconds. Output of every check is shown after all have finished.
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
];

function run({ name, args }) {
  const started = Date.now();
  return new Promise((done) => {
    const child = spawn(npx, ['--no-install', ...args], {
      cwd: root,
      shell: process.platform === 'win32',
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', (e) => done({ name, code: 1, out: String(e), ms: Date.now() - started }));
    child.on('close', (code) => done({ name, code: code ?? 1, out, ms: Date.now() - started }));
  });
}

const begin = Date.now();
const results = await Promise.all(checks.map(run));
for (const r of results) {
  const ok = r.code === 0;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.name} (${(r.ms / 1000).toFixed(1)} s)`);
  if (!ok && r.out.trim()) console.log(r.out.trimEnd() + '\n');
}
const failed = results.filter((r) => r.code !== 0).length;
console.log(
  `${failed === 0 ? 'All checks passed' : `${failed} check(s) failed`} in ${((Date.now() - begin) / 1000).toFixed(1)} s`,
);
process.exit(failed === 0 ? 0 : 1);
