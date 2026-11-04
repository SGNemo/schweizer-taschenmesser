#!/usr/bin/env node
/**
 * Creates a change note in `.changes/`.
 *
 *   npm run change                       interactive
 *   npm run change -- --type fixed --area calendar --de "…" --en "…" [--breaking] [--highlight] [--pr 12] [--slug name]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { AREAS, TYPES, formatChangeFile, parseChangeFile } from './lib/changes.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined);
const flag = (n) => argv.includes(`--${n}`);

let rl;
const ask = async (q, def = '') => {
  rl ??= createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(def ? `${q} [${def}] ` : `${q} `)).trim();
  return a || def;
};
const branch = (() => {
  try {
    return execFileSync('git', ['branch', '--show-current'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
})();

const entry = {
  type: opt('type') ?? (await ask(`Type (${TYPES.join('/')}):`, 'changed')),
  area: opt('area') ?? (await ask(`Area (${Object.keys(AREAS).join(', ')}):`)),
  breaking: flag('breaking') || (!argv.length && /^y/i.test(await ask('Breaking? (y/N)', 'n'))),
  highlight:
    flag('highlight') ||
    (!argv.length && /^y/i.test(await ask('Highlight (top 1-3 of a release)? (y/N)', 'n'))),
  de: opt('de') ?? (await ask('Deutsch, ein Satz, ohne Technik:')),
  en: opt('en') ?? (await ask('English, same sentence:')),
  ...(opt('pr') ? { pr: Number(opt('pr')) } : {}),
};
rl?.close();
const text = formatChangeFile([entry]);
const check = parseChangeFile(text, 'new note');
if (check.errors.length) {
  console.error(check.errors.join('\n'));
  process.exit(1);
}
const slug = (opt('slug') ?? (branch.replace(/^[a-z]+\//, '') || entry.area))
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');
const dir = join(root, '.changes');
mkdirSync(dir, { recursive: true });
let name = `${slug}-${entry.type}.md`;
for (let i = 2; existsSync(join(dir, name)); i++) name = `${slug}-${entry.type}-${i}.md`;
writeFileSync(join(dir, name), text);
console.log(`Created .changes/${name}`);
