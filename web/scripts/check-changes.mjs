#!/usr/bin/env node
/**
 * Validates `.changes/*.md`. With `--pr`: the PR must add a note or carry the label `no-changelog`.
 *
 *   node scripts/check-changes.mjs                 schema only
 *   node scripts/check-changes.mjs --pr [--base origin/develop]   labels from env PR_LABELS (comma list)
 */
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChanges } from './lib/changesDir.ts';
import { checkPullRequest } from './lib/changesCheck.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const problems = [...loadChanges(join(root, '.changes')).errors];
if (argv.includes('--pr')) {
  const base = argv[argv.indexOf('--base') + 1] ?? 'origin/develop';
  const changedFiles = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=AM', `${base}...HEAD`],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )
    .split('\n')
    .filter(Boolean);
  const labels = (process.env.PR_LABELS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const missing = checkPullRequest({ changedFiles, labels });
  if (missing) problems.push(missing);
}
if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log('Change notes OK.');
