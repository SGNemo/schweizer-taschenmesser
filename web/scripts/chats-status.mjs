#!/usr/bin/env node
/**
 * `npm run chats:status`: where the other chats work right now. Git only (no GitHub token): every
 * remote branch except main/develop/dependabot with its age, commits ahead of develop, changed
 * files and the files it shares with your branch (committed + uncommitted). Then the scribble
 * board (repo root `scribble/`, develop only): open items and per-branch notes.
 * Flags: --no-fetch (skip `git fetch`), --files (list every changed file per branch).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = new Set(process.argv.slice(2));
const git = (...args) =>
  execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
const lines = (s) => (s ? s.split('\n').filter(Boolean) : []);

if (!argv.has('--no-fetch')) {
  try {
    execFileSync('git', ['fetch', '--prune', '--quiet', 'origin'], { cwd: repo, stdio: 'ignore' });
  } catch {
    console.log('(fetch failed – showing what is known locally)');
  }
}

const BASE = 'origin/develop';
const mine = git('rev-parse', '--abbrev-ref', 'HEAD');
const myBase = git('merge-base', BASE, 'HEAD');
const myFiles = new Set([
  ...lines(git('diff', '--name-only', myBase, 'HEAD')),
  ...lines(git('status', '--porcelain')).map((l) => l.slice(3).trim()),
]);

const refs = lines(
  git(
    'for-each-ref',
    '--format=%(refname:short)\t%(committerdate:iso-strict)\t%(subject)',
    'refs/remotes/origin',
  ),
)
  .map((l) => l.split('\t'))
  .filter(([ref]) => !/^origin\/(HEAD|main|develop|dependabot\/)/.test(ref))
  .filter(([ref]) => ref !== `origin/${mine}`);

const days = (iso) => Math.round((Date.now() - Date.parse(iso)) / 86_400_000);
const dirs = (files) => [...new Set(files.map((f) => f.split('/').slice(0, 3).join('/')))];

console.log(`You: ${mine} (${myFiles.size} files vs ${BASE})\n`);
if (refs.length === 0) console.log('No other branches on origin.');
const rows = refs
  .map(([ref, date, subject]) => {
    const base = git('merge-base', BASE, ref);
    const files = lines(git('diff', '--name-only', base, ref));
    const ahead = lines(git('rev-list', `${base}..${ref}`)).length;
    const overlap = files.filter((f) => myFiles.has(f));
    return { ref, date, subject, files, ahead, overlap };
  })
  .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
for (const r of rows) {
  const flag = r.overlap.length ? '  !! overlap' : '';
  console.log(
    `${r.ref}  ·  ${days(r.date)} d ago  ·  ${r.ahead} commits  ·  ${r.files.length} files${flag}`,
  );
  console.log(`   ${r.subject}`);
  const shown = argv.has('--files') ? r.files : dirs(r.files).slice(0, 6);
  if (shown.length)
    console.log(
      `   ${shown.join(', ')}${!argv.has('--files') && dirs(r.files).length > 6 ? ', …' : ''}`,
    );
  for (const f of r.overlap) console.log(`   !! both touch ${f}`);
}

const scribble = join(repo, 'scribble');
console.log('');
if (!existsSync(scribble)) {
  console.log(
    'scribble/ is missing on this branch (develop only; restore with `git checkout origin/develop -- scribble`).',
  );
} else {
  const board = join(scribble, 'BOARD.md');
  const open = existsSync(board)
    ? lines(readFileSync(board, 'utf8')).filter((l) => /^- \[ \]/.test(l))
    : [];
  console.log(`scribble/BOARD.md: ${open.length} open item(s)`);
  for (const l of open) console.log(`   ${l}`);
  const notes = readdirSync(scribble).filter(
    (n) => n.endsWith('.md') && !['README.md', 'BOARD.md'].includes(n),
  );
  for (const n of notes) {
    const first = lines(readFileSync(join(scribble, n), 'utf8'))[0] ?? '';
    console.log(`scribble/${n}: ${first.slice(0, 100)}`);
  }
}
