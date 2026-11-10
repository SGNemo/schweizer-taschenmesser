#!/usr/bin/env node
/**
 * Measures what the Markdown docs cost an AI chat. No network, no dependencies; reads the working tree and local git.
 *   node scripts/docs/measure.mjs            Markdown report on stdout
 *   node scripts/docs/measure.mjs --json     the numbers only (for a before/after comparison)
 *   --notes <dir>                            a clone of the notes repo (default: $NEMO_SCRIBBLE_DIR, ../nemo-scribble)
 * Tokens are estimated as bytes / 4, the same rule as `web/scripts/check-docs.mjs`.
 * What a chat or agent has to read at its start is listed in START below; change it there when the rules change.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const asJson = process.argv.includes('--json');
const STALE_DAYS = 14;

const git = (...args) =>
  execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const read = (rel) => readFileSync(join(repo, rel), 'utf8');
const has = (rel) => existsSync(join(repo, rel));
const tokens = (text) => Math.ceil(Buffer.byteLength(text) / 4);
const fileTokens = (rel) => (has(rel) && statSync(join(repo, rel)).isFile() ? tokens(read(rel)) : 0);

// ---------------------------------------------------------------- what a chat reads at its start
/** A section of a file, by heading text (the block up to the next heading of the same or a higher level). */
function section(rel, heading) {
  if (!has(rel)) return '';
  const lines = read(rel).split('\n');
  const start = lines.findIndex((l) => /^#+\s/.test(l) && l.replace(/^#+\s*/, '').trim() === heading);
  if (start < 0) return '';
  const level = lines[start].match(/^#+/)[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s/);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}
const anchors = (names) => ({
  label: `docs/PROMPT-TEMPLATES.md (${names.map((n) => `#${n}`).join(' ')})`,
  tokens: names.reduce((sum, n) => sum + tokens(section('docs/PROMPT-TEMPLATES.md', n)), 0),
});
const file = (rel, note) => ({ label: note ? `${rel} (${note})` : rel, tokens: fileTokens(rel) });

/** The board between chats: the notes repo when a clone is at hand (`--notes`, NEMO_SCRIBBLE_DIR, ../nemo-scribble). */
function board() {
  const arg = process.argv.indexOf('--notes');
  const dirs = [arg > 0 ? process.argv[arg + 1] : null, process.env.NEMO_SCRIBBLE_DIR, join(repo, '..', 'nemo-scribble')];
  const dir = dirs.find((d) => d && existsSync(join(d, 'board')));
  if (!dir) {
    if (arg > 0) console.error(`--notes ${process.argv[arg + 1]}: no board/ folder there`);
    console.error('no board found (pass --notes <clone of the notes repo>): counted as 0');
    return { label: 'no notes repo clone found', tokens: 0 };
  }
  const items = readdirSync(join(dir, 'board')).filter((f) => f.endsWith('.md'));
  const text = items.map((f) => readFileSync(join(dir, 'board', f), 'utf8'));
  const open = text.filter((t) => !/^- \[x\]/i.test(t)).length;
  return {
    label: `notes repo board/ (${items.length} items, ${open} open; read in full = upper bound, \`chats:status\` prints first lines only)`,
    tokens: text.reduce((s, t) => s + tokens(t), 0),
  };
}

// The blocks a prompt head cites for a Claude Code chat (#routing is read by the prompt's author, not the chat).
const HEAD_ANCHORS = ['git', 'hard-rules', 'knowledge', 'questions', 'closing', 'pr-text'];
// Every chat: root rules, the index, the running-work page, the status page it has to add a line to,
// the prompt blocks its head line cites, and the board between chats.
const EVERY_CHAT = [
  file('CLAUDE.md', 'always loaded'),
  file('docs/README.md'),
  file('docs/CHATS.md'),
  file('docs/STATUS.md', 'one line goes in; the file is opened for it'),
  anchors(HEAD_ANCHORS),
  board(),
];
const START = {
  'Module fix': [
    ...EVERY_CHAT,
    file('web/src/modules/CLAUDE.md', 'loaded when working there'),
    file('docs/ARCHITECTURE-MAP.md'),
    file('docs/howto/design-rules.md'),
    file('docs/howto/changelog.md'),
  ],
  'Docs PR': [...EVERY_CHAT, file('docs/meta/DOCS-GUIDE.md')],
  'New module': [
    ...EVERY_CHAT,
    file('web/src/modules/CLAUDE.md', 'loaded when working there'),
    file('docs/ARCHITECTURE-MAP.md'),
    file('docs/RULES.md'),
    file('docs/howto/new-module.md'),
    file('docs/howto/seed-data.md'),
    file('docs/howto/design-rules.md'),
    file('docs/design/MODULE-IDENTITY.md'),
    file('docs/design/FOCUS-GUIDELINES.md'),
    file('docs/howto/changelog.md'),
  ],
};
const AGENT_DIR = 'docs/meta/agents-v3';
const AGENTS = ['lead', 'builder', 'reviewer', 'auditor', 'merge', 'ops', 'docs'];
// An agent thread: its system prompt, SHARED.md (read once per thread), root CLAUDE.md, and the running-work page.
const agentStart = (name) => [
  file(`${AGENT_DIR}/nemo-${name}.md`, 'system prompt'),
  file(`${AGENT_DIR}/SHARED.md`),
  file('CLAUDE.md'),
  ...(name === 'lead' ? [file('docs/CHATS.md'), file('docs/meta/WORK-ROUTING.md')] : []),
];
const sum = (parts) => parts.reduce((s, p) => s + p.tokens, 0);

// ---------------------------------------------------------------- inventory
const SKIP = /(^|\/)(node_modules|target|dist|gen)\//;
const mdFiles = git('ls-files', '-co', '--exclude-standard', '-z', '--', '*.md')
  .split('\0')
  .filter((f) => f && !SKIP.test(f) && has(f));
const sizes = mdFiles.map((f) => {
  const text = read(f);
  return { file: f, chars: text.length, tokens: tokens(text), lines: text.split('\n').length };
});
const folderOf = (f) => {
  const p = f.split('/');
  if (p.length === 1) return '(root)';
  if (p[0] === 'docs') return p.length === 2 ? 'docs/ (top level)' : `docs/${p[1]}/`;
  return `${p[0]}/`;
};
const folders = {};
for (const s of sizes) {
  const k = folderOf(s.file);
  folders[k] ??= { files: 0, tokens: 0 };
  folders[k].files++;
  folders[k].tokens += s.tokens;
}

// ---------------------------------------------------------------- freshness
// Last commit per file in one pass (the date a file was last touched; a pure reformat counts too).
const lastChange = {};
{
  let date = '';
  for (const line of git('log', '--format=@%cs', '--name-only', '--', '*.md').split('\n')) {
    if (line.startsWith('@')) date = line.slice(1);
    else if (line && !(line in lastChange)) lastChange[line] = date;
  }
}
const today = git('log', '-1', '--format=%cs').trim();
const daysOld = (d) => (d ? Math.round((Date.parse(today) - Date.parse(d)) / 864e5) : null);

const SCAN = (f) =>
  !/^docs\/archive\//.test(f) && !/^CHANGELOG/.test(f) && !/^\.changes\//.test(f) && !/^scribble\//.test(f);
const remoteBranches = new Set(
  git('branch', '-r', '--format=%(refname:short)')
    .split('\n')
    .map((b) => b.replace(/^origin\//, ''))
    .filter((b) => b && b !== 'HEAD' && b !== 'origin'),
);
// Without remote branches (no remote, single-branch or CI checkout) "gone" would mean every branch: skip that finding.
const knowsBranches = remoteBranches.size > 1;
const shallow = git('rev-parse', '--is-shallow-repository').trim() === 'true';
const STALE = [
  ['five app languages', /\b(five|5|fünf) (app |UI )?(languages|Sprachen)\b/i],
  ['21 agents / agents-v2 as current', /\b21 agents\b|\b21 Agenten\b/i],
  ['in-repo scribble folder as the place for notes', /(^|[^/\w-])scribble\/(BOARD|README|<)|chore\/scribble-/],
  ['identity v1/v2 as current', /identity[- ]v[12]\b(?!.*(old|replaced|superseded|history))/i],
  ['old product name in running text', /\bSchweizer Taschenmesser\b(?!.*(formerly|früher|internal|intern))/],
];
const PATH_ROOTS = /^(web|server|docs|scripts|mcp|extension|packages|contract|site|design|services|tools|\.github|\.changes)\//;
const findings = { deadLinks: [], missingPaths: [], goneBranches: [], stale: [] };
for (const f of mdFiles.filter(SCAN)) {
  const text = read(f);
  const body = text.replace(/```[\s\S]*?```/g, '');
  for (const m of body.replace(/`[^`\n]*`/g, '').matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1].split('#')[0];
    if (!target || /^(https?:|mailto:|tel:|data:)/.test(target)) continue;
    let abs;
    try {
      abs = resolve(dirname(join(repo, f)), decodeURI(target));
    } catch {
      continue;
    }
    if (!existsSync(abs)) findings.deadLinks.push(`${f} → ${m[1]}`);
  }
  for (const m of body.matchAll(/`([^`\n]+)`/g)) {
    const code = m[1].trim();
    if (PATH_ROOTS.test(code) && !/[*<>{}|…\s$]|\.\.\./.test(code)) {
      const p = code.replace(/[:#].*$/, '').replace(/[.,;)]+$/, '');
      if (!has(p)) findings.missingPaths.push(`${f} → ${p}`);
    } else if (/^(feat|fix|docs|ci|chore|review|qa|perf|test|design)\/[a-z0-9][a-z0-9._-]+$/.test(code)) {
      if (knowsBranches && !remoteBranches.has(code)) findings.goneBranches.push(`${f} → ${code}`);
    }
  }
  for (const [label, re] of STALE) {
    const n = text.split('\n').filter((l) => re.test(l)).length;
    if (n) findings.stale.push({ file: f, label, lines: n });
  }
}

// Same long line in two files (or twice in one): one of them is not the source.
const seen = new Map();
for (const f of mdFiles.filter(SCAN)) {
  read(f)
    .split('\n')
    .forEach((raw) => {
      const line = raw.replace(/\s+/g, ' ').trim();
      if (line.length < 120 || /^\|?[\s|:-]+\|?$/.test(line)) return;
      const hit = seen.get(line) ?? [];
      hit.push(f);
      seen.set(line, hit);
    });
}
const dupPairs = {};
for (const [line, files] of seen) {
  if (files.length < 2) continue;
  const key = [...new Set(files)].sort().join(' ↔ ') + ([...new Set(files)].length === 1 ? ' (twice)' : '');
  dupPairs[key] ??= { lines: 0, tokens: 0 };
  dupPairs[key].lines += files.length - 1;
  dupPairs[key].tokens += tokens(line) * (files.length - 1);
}

// ---------------------------------------------------------------- CHATS and STATUS
/** Age of every line by `git blame`, plus rows that only record something already merged. */
function ageReport(rel) {
  if (!has(rel)) return null;
  const lines = read(rel).split('\n');
  const dates = [];
  try {
    for (const l of git('blame', '--line-porcelain', '--', rel).split('\n'))
      if (l.startsWith('committer-time ')) dates.push(new Date(Number(l.slice(15)) * 1000).toISOString().slice(0, 10));
  } catch {
    /* new, uncommitted file */
  }
  const rows = lines.map((text, i) => ({ text, age: daysOld(dates[i]) })).filter((r) => r.text.trim());
  const tableRows = rows.filter((r) => /^\|/.test(r.text) && !/^\|[\s|:-]+\|?$/.test(r.text));
  const merged = /\b(gemergt|merged)\b/i;
  const branchDone = (text) =>
    [...text.matchAll(/`((?:feat|fix|docs|ci|chore|review|qa|perf|test|design)\/[a-z0-9._-]+)`/g)].some(
      (m) => knowsBranches && !remoteBranches.has(m[1]),
    );
  return {
    lines: lines.length,
    tokens: tokens(lines.join('\n')),
    contentLines: rows.length,
    tableRows: tableRows.length,
    rowsSayingMerged: rows.filter((r) => merged.test(r.text)).length,
    rowsWithGoneBranch: rows.filter((r) => branchDone(r.text)).length,
    linesOlderThanTwoWeeks: rows.filter((r) => r.age !== null && r.age > STALE_DAYS).length,
    duplicateRows: tableRows.length - new Set(tableRows.map((r) => r.text.replace(/\s+/g, ' '))).size,
  };
}

// ---------------------------------------------------------------- output
const result = {
  date: today,
  totals: { files: sizes.length, tokens: sum(sizes), chars: sizes.reduce((s, x) => s + x.chars, 0) },
  top: [...sizes].sort((a, b) => b.tokens - a.tokens).slice(0, 30),
  folders: Object.entries(folders).sort((a, b) => b[1].tokens - a[1].tokens),
  start: Object.fromEntries(Object.entries(START).map(([k, parts]) => [k, { total: sum(parts), parts }])),
  agents: Object.fromEntries(AGENTS.map((a) => [a, { total: sum(agentStart(a)), parts: agentStart(a) }])),
  chats: ageReport('docs/CHATS.md'),
  status: ageReport('docs/STATUS.md'),
  findings: {
    deadLinks: findings.deadLinks,
    missingPaths: findings.missingPaths,
    goneBranches: findings.goneBranches,
    stale: findings.stale,
    duplicates: Object.entries(dupPairs).sort((a, b) => b[1].tokens - a[1].tokens),
  },
  untouched: sizes
    .map((s) => ({ ...s, last: lastChange[s.file] ?? null, age: daysOld(lastChange[s.file]) }))
    .filter((s) => SCAN(s.file) && s.age !== null && s.age > STALE_DAYS)
    .sort((a, b) => b.tokens - a.tokens),
};

if (asJson) {
  console.log(JSON.stringify(result, null, 1));
  process.exit(0);
}

const n = (x) => x.toLocaleString('en-US');
const table = (head, rows) =>
  [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const byFile = (list) => {
  const count = {};
  for (const item of list) {
    const f = item.split(' → ')[0];
    count[f] = (count[f] ?? 0) + 1;
  }
  return Object.entries(count).sort((a, b) => b[1] - a[1]);
};
const out = [];
out.push(`# Docs measurement (${today})`, '');
out.push(`${n(result.totals.files)} Markdown files, ${n(result.totals.chars)} characters, ≈ ${n(result.totals.tokens)} tokens (bytes / 4).`, '');
out.push('## Start cost of a chat (tokens)', '');
for (const [name, s] of Object.entries(result.start)) {
  out.push(`**${name}: ≈ ${n(s.total)}**`, '', table(['Read', 'Tokens'], s.parts.map((p) => [p.label, n(p.tokens)])), '');
}
out.push('## Start cost of an agent thread (tokens)', '');
out.push(
  table(
    ['Agent', 'Total', 'Parts'],
    Object.entries(result.agents).map(([a, s]) => [
      `nemo-${a}`,
      n(s.total),
      s.parts.map((p) => `${p.label.replace(`${AGENT_DIR}/`, '')} ${n(p.tokens)}`).join(' · '),
    ]),
  ),
  '',
);
out.push('## CHATS.md and STATUS.md', '');
out.push(
  table(
    ['File', 'Lines', 'Tokens', 'Table rows', 'Rows saying "merged"', 'Rows naming a branch that is gone', `Lines unchanged > ${STALE_DAYS} d`, 'Duplicate rows'],
    [
      ['docs/CHATS.md', result.chats],
      ['docs/STATUS.md', result.status],
    ]
      .filter(([, r]) => r)
      .map(([f, r]) => [f, r.lines, n(r.tokens), r.tableRows, r.rowsSayingMerged, r.rowsWithGoneBranch, r.linesOlderThanTwoWeeks, r.duplicateRows]),
  ),
  '',
);
out.push('## Top 30 files', '', table(['File', 'Chars', 'Tokens', 'Last change'], result.top.map((s) => [s.file, n(s.chars), n(s.tokens), lastChange[s.file] ?? '–'])), '');
out.push('## Tokens per folder', '', table(['Folder', 'Files', 'Tokens'], result.folders.map(([k, v]) => [k, v.files, n(v.tokens)])), '');
out.push('## Freshness', '');
if (!knowsBranches) out.push('- No remote branches in this clone: branch findings skipped.');
if (shallow) out.push('- Shallow clone: "last change" dates and line ages stop at the clone boundary.');
out.push(`- Dead relative links: ${result.findings.deadLinks.length}`);
for (const l of result.findings.deadLinks.slice(0, 40)) out.push(`  - ${l}`);
out.push(`- Paths in backticks that do not exist: ${result.findings.missingPaths.length} (per file: ${byFile(result.findings.missingPaths).slice(0, 15).map(([f, c]) => `${f} ${c}`).join(', ') || '–'})`);
out.push(`- Branch names that are no longer on the remote: ${result.findings.goneBranches.length} (per file: ${byFile(result.findings.goneBranches).slice(0, 15).map(([f, c]) => `${f} ${c}`).join(', ') || '–'})`);
out.push('- Stale wording:');
for (const s of result.findings.stale) out.push(`  - ${s.file}: ${s.label} (${s.lines} lines)`);
out.push('', '### The same long line in two places', '');
out.push(table(['Where', 'Lines', 'Tokens'], result.findings.duplicates.slice(0, 20).map(([k, v]) => [k, v.lines, n(v.tokens)])), '');
out.push(`### Largest files untouched for more than ${STALE_DAYS} days`, '');
out.push(table(['File', 'Tokens', 'Last change'], result.untouched.slice(0, 20).map((s) => [s.file, n(s.tokens), s.last])), '');
console.log(out.join('\n'));
