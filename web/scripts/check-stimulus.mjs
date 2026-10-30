#!/usr/bin/env node
/**
 * Stimulus budget: measures every page (e2e/screenshots/stimulus.spec.ts → inventory.json) and compares it
 * with e2e/stimulus-budget.json. Over budget → readable list, exit 1. Pure logic: scripts/lib/stimulusBudget.ts.
 *
 *   npm run check:stimulus                       measure + compare
 *   npm run stimulus:baseline                    measure + rewrite the budget (PRs that change the numbers on purpose)
 *   node scripts/check-stimulus.mjs --from <inventory.json> [--baseline]    skip the measurement
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compare, formatReport, makeBudget } from './lib/stimulusBudget.ts';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const budgetPath = resolve(web, 'e2e/stimulus-budget.json');
const args = process.argv.slice(2);
const baseline = args.includes('--baseline');
const fromIdx = args.indexOf('--from');
const outDir = resolve(web, process.env.STIMULUS_DIR ?? 'test-results/stimulus-check');

let inventoryPath;
if (fromIdx >= 0) {
  inventoryPath = resolve(args[fromIdx + 1] ?? '');
} else {
  mkdirSync(outDir, { recursive: true });
  const run = spawnSync('npx', ['playwright', 'test', '-c', 'playwright.stimulus.config.ts'], {
    cwd: web,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, STIMULUS_DIR: outDir, STIMULUS_SHOTS: '0' },
  });
  if (run.status !== 0) {
    console.error('Stimulus measurement failed (see above); nothing compared.');
    process.exit(2);
  }
  inventoryPath = resolve(outDir, 'inventory.json');
}
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));

if (baseline) {
  const budget = makeBudget(inventory);
  writeFileSync(budgetPath, `${JSON.stringify(budget, null, 1)}\n`);
  console.log(
    `Stimulus budget written: ${Object.keys(budget.pages).length} page × viewport entries → e2e/stimulus-budget.json`,
  );
  process.exit(0);
}

const result = compare(JSON.parse(readFileSync(budgetPath, 'utf8')), inventory);
console.log(formatReport(result));
if (result.violations.length) {
  console.error(
    '\nIntended? Then run `npm run stimulus:baseline` and commit e2e/stimulus-budget.json (say why in the PR).',
  );
  process.exit(1);
}
