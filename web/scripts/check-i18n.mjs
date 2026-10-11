#!/usr/bin/env node
/**
 * `npm run check:i18n`: keeps the five UI languages complete and the code free of UI text.
 *   1. Code: no German-looking UI text outside the catalogs (scripts/lib/i18nLiterals.ts); files
 *      that legitimately hold German (parsers, AI prompts, …) are listed with a reason in
 *      src/i18n/literal-allowlist.json.
 *   2. Code: no text read at import time (scripts/lib/i18nCaptures.ts) – it would not follow a
 *      language switch; use a getter or read it inside a function.
 *   3. Catalogs: every language has every text, nothing extra, nothing empty or untranslated, and
 *      every text function keeps its values (src/i18n/catalogs.test.ts via Vitest), plus the
 *      registry test that switches the language at runtime (src/i18n/noStaleTexts.test.ts).
 * Exits 1 on any problem (runs in CI).
 */
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findCaptures } from './lib/i18nCaptures.ts';
import { findLiterals } from './lib/i18nLiterals.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const allow = JSON.parse(readFileSync(resolve(root, 'src/i18n/literal-allowlist.json'), 'utf8'));
const files = execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx'", { cwd: root })
  .toString()
  .trim()
  .split('\n')
  .filter(
    (f) => !/\.test\.|__tests__|\.d\.ts$|\/seed\.ts$|\/seed\/|\/ai\.ts$|^src\/i18n\//.test(f),
  );

const problems = [];
for (const f of files) {
  const src = readFileSync(resolve(root, f), 'utf8');
  if (!allow[f])
    for (const l of findLiterals(f, src))
      problems.push(`${f}:${l.line} UI text in code: ${l.text}`);
  if (src.includes('@/strings'))
    for (const c of findCaptures(f, src))
      problems.push(`${f}:${c.line} text read at import time: ${c.text}`);
}
for (const f of Object.keys(allow))
  if (
    !f.startsWith('$') &&
    !files.includes(f) &&
    f !== 'src/strings.ts' &&
    f !== 'src/strings.dev.ts'
  )
    problems.push(`src/i18n/literal-allowlist.json: ${f} no longer exists`);

if (problems.length) {
  console.log(`${problems.length} problem(s) in the code:`);
  for (const p of problems) console.log(`  - ${p}`);
} else console.log(`OK: ${files.length} source files without UI text or import-time reads.`);

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const tests = spawnSync(
  npx,
  ['vitest', 'run', 'src/i18n/catalogs.test.ts', 'src/i18n/noStaleTexts.test.ts'],
  { cwd: root, stdio: 'inherit' },
);
if (problems.length || tests.status !== 0) process.exit(1);
