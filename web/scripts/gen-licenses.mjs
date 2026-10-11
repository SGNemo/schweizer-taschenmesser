#!/usr/bin/env node
/**
 * Licence list of everything Nemo ships → `src/core/about/licenses.json` (Settings → Über Nemo → Rechtliches).
 *
 *   npm run gen:licenses          writes the file: npm from package-lock.json (production, transitive),
 *                                 Cargo from `cargo metadata --all-features` (kept as is when cargo is missing),
 *                                 models from the catalogue, Gradle/fonts/icons from scripts/licenses.manual.json
 *   npm run check:licenses        changes nothing; exits 1 when the file is out of date against the lock files
 *                                 (package-lock.json, Cargo.lock, catalogue, manual list) or a licence is
 *                                 unknown / not on the allowlist (scripts/lib/licensePolicy.ts). Runs in `build` and CI.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cratesFromMetadata,
  lockedCrates,
  modelsFromCatalogue,
  npmFromLock,
  policyProblems,
} from './lib/licenseList.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = (...p) => JSON.parse(readFileSync(join(root, ...p), 'utf8'));
const out = join(root, 'src', 'core', 'about', 'licenses.json');
const check = process.argv.includes('--check');

let committed;
try {
  committed = JSON.parse(readFileSync(out, 'utf8'));
} catch {
  committed = undefined;
}

const manual = json('scripts', 'licenses.manual.json');
const lockedCargo = lockedCrates(readFileSync(join(root, 'src-tauri', 'Cargo.lock'), 'utf8'));

function cargoGroup() {
  if (check) return committed?.cargo ?? [];
  try {
    const meta = execFileSync(
      'cargo',
      ['metadata', '--format-version', '1', '--locked', '--all-features'],
      { cwd: join(root, 'src-tauri'), maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'inherit'] },
    );
    return cratesFromMetadata(JSON.parse(meta.toString()));
  } catch (e) {
    console.warn(
      `gen:licenses: cargo metadata failed (${e.message.split('\n')[0]}); keeping the Cargo list`,
    );
    return committed?.cargo ?? [];
  }
}

const data = {
  schema: 1,
  npm: npmFromLock(json('package-lock.json')),
  cargo: cargoGroup(),
  gradle: manual.gradle,
  assets: manual.assets,
  models: modelsFromCatalogue(json('src', 'core', 'ai', 'local', 'catalogue.json')),
};

const problems = policyProblems(data);

if (check) {
  // Every locked crate has to be listed (and nothing else); the licences of the listed ones were checked at generation.
  const listed = new Set((committed?.cargo ?? []).map((c) => `${c.name}@${c.version}`));
  const wanted = new Set([...lockedCargo].filter((k) => !k.startsWith('taschenmesser')));
  const missing = [...wanted].filter((k) => !listed.has(k));
  const extra = [...listed].filter((k) => !wanted.has(k));
  const stale =
    JSON.stringify({ ...data, cargo: [] }) !== JSON.stringify({ ...committed, cargo: [] });
  if (!committed || stale)
    problems.push(
      'licenses.json is out of date (npm, models or manual list): run `npm run gen:licenses`',
    );
  if (missing.length || extra.length) {
    problems.push(
      `Cargo list differs from Cargo.lock (missing ${missing.length}, extra ${extra.length}): run \`npm run gen:licenses\``,
    );
  }
  for (const p of problems) console.error(`check:licenses: ${p}`);
  if (problems.length) process.exit(1);
  console.log('check:licenses: ok');
} else {
  for (const p of problems) console.error(`gen:licenses: ${p}`);
  if (problems.length) process.exit(1);
  writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
  console.log(
    `gen:licenses: npm ${data.npm.length}, cargo ${data.cargo.length}, gradle ${data.gradle.length}, assets ${data.assets.length}, models ${data.models.length}`,
  );
}
