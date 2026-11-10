#!/usr/bin/env node
/**
 * Stimulus budget: measures every page (e2e/screenshots/stimulus.spec.ts → inventory.json) and compares it
 * with e2e/stimulus-budget.json, strict on both sides. Outside its band → readable list, exit 1.
 * Pure logic: scripts/lib/stimulusBudget.ts. Rules and how to lower a budget: docs/howto/ci.md.
 * This file is ratchet-protected (scripts/ratchet.mjs).
 *
 *   npm run check:stimulus                       measure + compare
 *   npm run stimulus:baseline                    measure + rewrite the budget with local numbers: to look, not to
 *                                                commit (the committed numbers are the ones the CI run measured)
 *   node scripts/check-stimulus.mjs --from <inventory.json> [--baseline]    skip the measurement
 */
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compare, formatReport, makeBudget, summaryMarkdown } from './lib/stimulusBudget.ts';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const budgetPath = resolve(web, 'e2e/stimulus-budget.json');
const blocksPath = resolve(web, 'scripts/baselines/signature-blocks.json');
const args = process.argv.slice(2);
const baseline = args.includes('--baseline');
const fromIdx = args.indexOf('--from');
const outDir = resolve(web, process.env.STIMULUS_DIR ?? 'test-results/stimulus-check');

// Read before anything of the build or the measurement runs: what is compared is what was committed.
// (Rewriting the budget does not need the old one.)
const budget = baseline ? undefined : JSON.parse(readFileSync(budgetPath, 'utf8'));
const signatureBlocks = baseline ? undefined : JSON.parse(readFileSync(blocksPath, 'utf8')).blocks;

let inventoryPath;
if (fromIdx >= 0) {
  inventoryPath = resolve(args[fromIdx + 1] ?? '');
} else {
  mkdirSync(outDir, { recursive: true });
  // Only the measuring spec: nothing else may run in the process that writes the inventory.
  const run = spawnSync(
    'npx',
    ['playwright', 'test', '-c', 'playwright.stimulus.config.ts', 'screenshots/stimulus.spec.ts'],
    {
      cwd: web,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, STIMULUS_DIR: outDir, STIMULUS_SHOTS: '0' },
    },
  );
  if (run.status !== 0) {
    console.error('Stimulus measurement failed (see above); nothing compared.');
    process.exit(2);
  }
  inventoryPath = resolve(outDir, 'inventory.json');
}
if (!existsSync(inventoryPath) || !statSync(inventoryPath).isFile()) {
  console.error(`No inventory at ${inventoryPath}; nothing compared.`);
  process.exit(2);
}
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));

if (baseline) {
  const fresh = makeBudget(inventory);
  writeFileSync(budgetPath, `${JSON.stringify(fresh, null, 2)}\n`);
  console.log(
    `Stimulus budget written: ${Object.keys(fresh.pages).length} page × viewport entries → e2e/stimulus-budget.json`,
  );
  process.exit(0);
}

const result = compare(budget, inventory, { signatureBlocks });
console.log(formatReport(result));
if (process.env.GITHUB_STEP_SUMMARY) {
  // The values of this run, in the form of the budget file: the only source for lowering a budget.
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown(result, inventory, budget));
}
if (process.env.CI || args.includes('--print')) {
  console.log('\nMeasured values of this run (budget form):');
  console.log(JSON.stringify(makeBudget(inventory, budget.tolerance)));
}
if (result.violations.length) {
  console.error(
    '\nBelow budget? Take the measured values of the CI run (job summary) into e2e/stimulus-budget.json: lowering is free.' +
      '\nOver budget on purpose, a page removed, or one added without a new manifest route? Take the CI values too; that is a ratchet hit:' +
      '\nname it in the PR text and wait for the maintainer (docs/howto/ci.md).',
  );
  process.exit(1);
}
