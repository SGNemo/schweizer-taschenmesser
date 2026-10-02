#!/usr/bin/env node
/**
 * `npm run check:docs`: keeps the Markdown docs cheap for AI chats.
 *   1. Start context = root CLAUDE.md + its `@imports` (what every chat loads) against a token budget.
 *   2. Per-file budgets for area CLAUDE.md files and lookup docs (docs/**, exempt dirs/files below).
 *   3. Dead relative links in every tracked-style Markdown file (docs/, root, area CLAUDE.md).
 * Tokens are estimated as bytes / 4 (no tokenizer needed). Budgets live in docs/meta/DOCS-GUIDE.md.
 * Warnings only (exit 0); `--strict` exits 1 when anything is over budget or a link is dead.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const strict = process.argv.includes('--strict');

const BUDGET = {
  start: 2600,
  area: 500,
  lookup: 3000,
  overrides: {
    'docs/README.md': 700,
    'docs/ARCHITECTURE-MAP.md': 3500,
    'docs/STATUS.md': 5000,
    'docs/CHATS.md': 2000,
    'docs/PROMPT-TEMPLATES.md': 2000,
    'docs/meta/DOCS-GUIDE.md': 1500,
  },
  // Never auto-loaded, long by nature (reports, German user docs, checklists, ideas, generated notes).
  exemptDirs: [
    'docs/user/',
    'docs/archive/',
    'docs/security/',
    'docs/perf/',
    'docs/features/',
    'docs/meta/',
    'docs/screenshots/',
    'docs/design-proposals/',
    'docs/design/',
    'docs/product/',
  ],
  exemptFiles: ['docs/AI-IMPORT.md', 'docs/MANUAL-TESTS.md', 'docs/ROADMAP.md'],
};
const SKIP_DIRS = new Set(['node_modules', '.git', 'target', 'dist', 'gen', 'permissions']);

const tokens = (text) => Math.ceil(Buffer.byteLength(text) / 4);
const rel = (p) => relative(repo, p).split('\\').join('/');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

const problems = [];
const lines = [];

// 1. start context
const rootClaude = join(repo, 'CLAUDE.md');
const rootText = readFileSync(rootClaude, 'utf8');
let start = tokens(rootText);
const parts = [['CLAUDE.md', start]];
for (const m of rootText.matchAll(/^@(\S+\.md)\s*$/gm)) {
  const p = join(repo, m[1]);
  if (!existsSync(p)) {
    problems.push(`CLAUDE.md imports missing file ${m[1]}`);
    continue;
  }
  const t = tokens(readFileSync(p, 'utf8'));
  parts.push([`@${m[1]}`, t]);
  start += t;
}
lines.push(
  `Start context: ~${start} tokens (budget ${BUDGET.start}): ${parts.map(([n, t]) => `${n} ${t}`).join(', ')}`,
);
if (start > BUDGET.start) problems.push(`start context ${start} > ${BUDGET.start} tokens`);

// 2. per-file budgets + 3. links
const files = [
  ...walk(join(repo, 'docs')),
  ...readdirSync(repo)
    .filter((n) => n.endsWith('.md'))
    .map((n) => join(repo, n)),
];
for (const dir of ['server', 'web/src/modules', 'web/src-tauri', 'mcp']) {
  const p = join(repo, dir, 'CLAUDE.md');
  if (existsSync(p)) files.push(p);
}
let total = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const name = rel(file);
  const t = tokens(text);
  total += t;
  let limit;
  if (name === 'CLAUDE.md') limit = undefined;
  else if (name.endsWith('/CLAUDE.md')) limit = BUDGET.area;
  else if (BUDGET.overrides[name]) limit = BUDGET.overrides[name];
  else if (
    name.startsWith('docs/') &&
    !BUDGET.exemptFiles.includes(name) &&
    !BUDGET.exemptDirs.some((d) => name.startsWith(d))
  )
    limit = BUDGET.lookup;
  if (limit && t > limit) problems.push(`${name}: ~${t} tokens > ${limit}`);
  const body = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const m of body.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1].split('#')[0];
    if (!target || /^(https?:|mailto:|tel:)/.test(target)) continue;
    if (!existsSync(resolve(dirname(file), decodeURI(target))))
      problems.push(`${name}: dead link ${m[1]}`);
  }
}
lines.push(
  `Markdown checked: ${files.length} files, ~${total} tokens in total (docs/, root, area CLAUDE.md).`,
);

console.log(lines.join('\n'));
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  - ${p}`);
  console.log('\nBudgets and rules: docs/meta/DOCS-GUIDE.md');
  if (strict) process.exit(1);
} else console.log('OK: within budgets, no dead links.');
