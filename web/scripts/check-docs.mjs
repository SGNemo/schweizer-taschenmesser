#!/usr/bin/env node
/**
 * `npm run check:docs`: keeps the Markdown docs cheap for AI chats.
 *   1. Start context = root CLAUDE.md + its `@imports` (what every chat loads) against a token budget.
 *   2. Per-file budgets for area CLAUDE.md files and lookup docs (docs/**, exempt dirs/files below).
 *   3. Dead relative links in every tracked-style Markdown file (docs/, root, area CLAUDE.md).
 *   4. Images under docs/: only README pictures, brand files and images linked from docs/user/, each ≤ 100 KB.
 *      Screenshots belong in the PR text or a workflow artifact (DOCS-GUIDE.md "Images").
 *   5. Freshness: CHATS.md table rows that list an open PR, say "merged"/"gemergt" or repeat another row; STATUS.md lines
 *      with "PR offen" or a backticked branch that `git branch -r` no longer lists.
 * Tokens are estimated as bytes / 4 (no tokenizer needed). Budgets live in docs/meta/DOCS-GUIDE.md.
 * Exit 1 (always): image rule, CHATS.md row rule, CHATS.md/STATUS.md over budget (they must not grow back),
 * start context over budget once START_CONTEXT_HARD is on. Everything else warns (exit 0; `--strict` exits 1).
 * `--root <dir>` checks another tree (tests).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const BUDGET = {
  start: 2600,
  area: 700,
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
// Files whose budget is a hard limit: running logs that tend to grow back (DOCS-GUIDE.md "Budgets").
export const HARD_BUDGET_FILES = ['docs/CHATS.md', 'docs/STATUS.md'];
// Start context over budget is fatal once root CLAUDE.md is back under BUDGET.start (own PR, maintainer
// merges; CLAUDE.md is a hotspot). Until then it warns like the other budgets.
export const START_CONTEXT_HARD = false;
// Branch prefixes from root CLAUDE.md step 3 and Conventional Commits; a backticked token with one of
// these prefixes in STATUS.md is treated as a branch name.
const BRANCH_RE =
  /^(?:feat|fix|docs|ci|chore|refactor|perf|test|build|style|release)\/[\w.-]+(?:\/[\w.-]+)*$/;
// Remote refs that say nothing about other chats' branches (single-branch CI checkouts).
const BASE_REFS = /^(?:HEAD|main|develop|pull\/.*)$/;

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

function walk(dir, out = [], match = (name) => name.endsWith('.md')) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out, match);
    else if (match(name)) out.push(p);
  }
  return out;
}

export const tokens = (text) => Math.ceil(Buffer.byteLength(text) / 4);

/** Problems in docs/CHATS.md: rows of an open-PR list, rows about merged PRs, duplicate rows (a row = an open item). */
export function chatsProblems(text) {
  const out = [];
  const seen = new Map();
  text.split(/\r?\n/).forEach((line, i) => {
    const row = line.trim();
    if (!row.startsWith('|') || /^\|[\s|:-]*\|$/.test(row)) return; // not a row, or the --- separator
    const n = i + 1;
    // A list of open PRs is a snapshot of GitHub: committed by every branch it conflicts on every merge.
    if (/^\|\s*\[#\d+\]\([^)]*\/pull\/\d+\)/.test(row)) {
      out.push(
        `docs/CHATS.md:${n}: row of the open-PR list – delete it, \`npm run chats:sync\` prints the list`,
      );
      return;
    }
    if (/(?<![\w-])(?:gemergt\w*|merged)\b/i.test(row))
      out.push(`docs/CHATS.md:${n}: row about a merged PR – delete it (${row.slice(0, 60)}…)`);
    const key = row.replace(/\s+/g, ' ');
    if (seen.has(key)) out.push(`docs/CHATS.md:${n}: same row as line ${seen.get(key)} – keep one`);
    else seen.set(key, n);
  });
  return out;
}

/**
 * Warnings for docs/STATUS.md: "PR offen" lines and backticked branches missing from `remoteBranches`
 * (names without `origin/`). `remoteBranches` null = unknown (no remote branches in this clone): branch
 * check skipped. `exists(token)` = token is a repo path (e.g. `docs/brand/x.png`), not a branch.
 * @param {string} text
 * @param {Set<string> | null} remoteBranches
 * @param {(path: string) => boolean} [exists]
 */
export function statusWarnings(text, remoteBranches, exists = () => false) {
  const out = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const n = i + 1;
    if (/\bPR offen\b/i.test(line))
      out.push(
        `docs/STATUS.md:${n}: "PR offen" – STATUS holds the state, open PRs live on GitHub/CHATS.md`,
      );
    if (!remoteBranches) return;
    for (const m of line.matchAll(/`([^`\s]+)`/g)) {
      const name = m[1];
      if (!BRANCH_RE.test(name) || remoteBranches.has(name) || exists(name)) continue;
      out.push(
        `docs/STATUS.md:${n}: branch \`${name}\` is not on the remote – check whether the line is still current`,
      );
    }
  });
  return out;
}

/** Remote branch names (without the remote prefix), or null when the clone has none besides base refs. */
export function remoteBranches(cwd) {
  let names;
  try {
    names = execFileSync('git', ['branch', '-r', '--format=%(refname:lstrip=3)'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
  return names.some((n) => !BASE_REFS.test(n)) ? new Set(names) : null;
}

/** Whether a budget overrun in `name` (repo-relative) is fatal. */
export const isHardBudget = (name, startHard = START_CONTEXT_HARD) =>
  name === 'start context' ? startHard : HARD_BUDGET_FILES.includes(name);

function main(argv) {
  const rootArg = argv.indexOf('--root');
  const repo =
    rootArg >= 0
      ? resolve(argv[rootArg + 1])
      : resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const strict = argv.includes('--strict');
  const rel = (p) => relative(repo, p).split('\\').join('/');

  const problems = []; // warnings (exit 1 only with --strict)
  const fatal = []; // always exit 1
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
  if (start > BUDGET.start)
    (isHardBudget('start context') ? fatal : problems).push(
      `start context ${start} > ${BUDGET.start} tokens`,
    );

  // 2. per-file budgets + 3. links
  const files = [
    ...walk(join(repo, 'docs')),
    ...readdirSync(repo)
      .filter((n) => n.endsWith('.md'))
      .map((n) => join(repo, n)),
  ];
  for (const dir of ['server', 'web/src/modules', 'web/src-tauri', 'mcp', 'extension']) {
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
    if (limit && t > limit)
      (isHardBudget(name) ? fatal : problems).push(`${name}: ~${t} tokens > ${limit}`);
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
  // Tracked + untracked-but-not-ignored files (what a commit could add); plain walk outside a git checkout.
  let docFiles;
  try {
    docFiles = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z', 'docs'], {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\0')
      .filter((p) => p && existsSync(join(repo, p)))
      .map((p) => join(repo, p));
  } catch {
    docFiles = walk(join(repo, 'docs'), [], () => true);
  }
  for (const file of docFiles.filter((f) => IMAGES.ext.test(f))) {
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
  // 5. freshness of the running logs
  const chats = join(repo, 'docs/CHATS.md');
  if (existsSync(chats)) fatal.push(...chatsProblems(readFileSync(chats, 'utf8')));
  const status = join(repo, 'docs/STATUS.md');
  if (existsSync(status)) {
    const remotes = remoteBranches(repo);
    if (!remotes) lines.push('STATUS.md branch check skipped: no remote branches in this clone.');
    problems.push(
      ...statusWarnings(
        readFileSync(status, 'utf8'),
        remotes,
        (p) => existsSync(join(repo, p)) || existsSync(join(repo, 'docs', p)),
      ),
    );
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
  if (fatal.length) {
    console.log(`\n${fatal.length} blocking problem(s):`);
    for (const p of fatal) console.log(`  - ${p}`);
  }
  if (problems.length) {
    console.log(`\n${problems.length} warning(s):`);
    for (const p of problems) console.log(`  - ${p}`);
  }
  if (fatal.length || problems.length) console.log('\nBudgets and rules: docs/meta/DOCS-GUIDE.md');
  else if (!imageProblems.length) console.log('OK: within budgets, no dead links, no stale rows.');
  if (imageProblems.length || fatal.length || (strict && problems.length)) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  main(process.argv.slice(2));
