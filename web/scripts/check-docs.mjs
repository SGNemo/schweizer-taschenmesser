#!/usr/bin/env node
/**
 * `npm run check:docs`: keeps the Markdown docs cheap for AI chats.
 *   1. Start context = root CLAUDE.md + its `@imports` (what every chat loads) against a token budget.
 *   2. Per-file budgets for area CLAUDE.md files and lookup docs (docs/**, exempt dirs/files below).
 *   3. Dead relative links in every tracked-style Markdown file (docs/, root, area CLAUDE.md).
 *   4. Images under docs/: only README pictures, brand files and images linked from docs/user/, each ≤ 100 KB.
 *      Screenshots belong in the PR text or a workflow artifact (DOCS-GUIDE.md "Images").
 * Tokens are estimated as bytes / 4 (no tokenizer needed). Budgets live in docs/meta/DOCS-GUIDE.md.
 * Budgets and links warn (exit 0; `--strict` exits 1); an image rule violation always exits 1.
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
    'docs/ARCHITECTURE-MAP.md': 4200,
    'docs/STATUS.md': 5000,
    'docs/DECISIONS.md': 3500,
    'docs/CHATS.md': 2000,
    'docs/PROMPT-TEMPLATES.md': 2000,
    'docs/meta/DOCS-GUIDE.md': 1500,
  },
  // Never auto-loaded, long by nature (reports, user docs and their German copies, checklists, ideas, generated notes).
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
  exemptFiles: [
    'docs/AI-IMPORT.md',
    'docs/AI-IMPORT.de.md',
    'docs/MANUAL-TESTS.md',
    'docs/ROADMAP.md',
  ],
};
// Images allowed under docs/ (everything else: PR text or workflow artifact). Max size per image.
const IMAGES = {
  ext: /\.(png|jpe?g|webp|gif|avif|bmp|tiff?)$/i,
  allowed: [/^docs\/assets\/screenshots\/[^/]+\.webp$/, /^docs\/brand\//],
  maxBytes: 100 * 1024,
  // Brand files above the limit that predate the rule (social preview 1280×640, README header).
  oversizeOk: [
    'docs/brand/header.png',
    'docs/brand/header.de.png',
    'docs/brand/social-preview.png',
    'docs/brand/social-preview.de.png',
  ],
};
const SKIP_DIRS = new Set(['node_modules', '.git', 'target', 'dist', 'gen', 'permissions']);

const tokens = (text) => Math.ceil(Buffer.byteLength(text) / 4);
const rel = (p) => relative(repo, p).split('\\').join('/');

function walk(dir, out = [], match = (name) => name.endsWith('.md')) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out, match);
    else if (match(name)) out.push(p);
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
const userDocImages = new Set();
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
  for (const m of body.matchAll(/\]\(([^)\s]+)\)|\b(?:src|srcset)="([^"\s]+)"/g)) {
    const link = m[1] ?? m[2];
    const target = link.split('#')[0];
    if (!target || /^(https?:|mailto:|tel:|data:)/.test(target)) continue;
    const abs = resolve(dirname(file), decodeURI(target));
    if (!existsSync(abs)) problems.push(`${name}: dead link ${link}`);
    else if (name.startsWith('docs/user/')) userDocImages.add(rel(abs));
  }
}

// 4. images under docs/ (always fatal: binaries bloat every clone)
const imageProblems = [];
for (const file of walk(join(repo, 'docs'), [], (n) => IMAGES.ext.test(n))) {
  const name = rel(file);
  const allowed = IMAGES.allowed.some((r) => r.test(name)) || userDocImages.has(name);
  if (!allowed) {
    imageProblems.push(
      `${name}: image outside docs/assets/screenshots, docs/brand or docs/user links`,
    );
    continue;
  }
  const size = statSync(file).size;
  if (size > IMAGES.maxBytes && !IMAGES.oversizeOk.includes(name))
    imageProblems.push(`${name}: ${Math.round(size / 1024)} KB > ${IMAGES.maxBytes / 1024} KB`);
}
lines.push(
  `Markdown checked: ${files.length} files, ~${total} tokens in total (docs/, root, area CLAUDE.md).`,
);

console.log(lines.join('\n'));
if (imageProblems.length) {
  console.log(`\n${imageProblems.length} image(s) not allowed in docs/:`);
  for (const p of imageProblems) console.log(`  - ${p}`);
  console.log(
    '\nScreenshots go into the PR text (drag & drop) or a workflow artifact, local captures into web/.screens/.' +
      '\nRule: docs/meta/DOCS-GUIDE.md "Images".',
  );
}
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  - ${p}`);
  console.log('\nBudgets and rules: docs/meta/DOCS-GUIDE.md');
  if (strict || imageProblems.length) process.exit(1);
} else if (imageProblems.length) process.exit(1);
else console.log('OK: within budgets, no dead links.');
