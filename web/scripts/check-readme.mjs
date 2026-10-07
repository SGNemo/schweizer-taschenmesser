#!/usr/bin/env node
/**
 * `npm run check:readme`: English docs and their German translations stay in step.
 *   Pairs: README.md ↔ README.de.md, docs/AI-IMPORT.md ↔ .de.md, every docs/user/x.md ↔ x.de.md.
 *   1. Both files of a pair exist.
 *   2. Same heading outline, <details> count, external links, local images and relative targets (scripts/lib/docPairs.ts).
 *   3. A German file links the German twin of a doc when one exists (except its own language line).
 *   4. Every relative link target exists.
 * Exits 1 on any problem (runs in CI).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareDocs, englishTwin } from './lib/docPairs.ts';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(repo, p), 'utf8');
const rel = (p) => relative(repo, p).split('\\').join('/');

const userDir = 'docs/user';
const userFiles = readdirSync(join(repo, userDir)).filter((n) => n.endsWith('.md'));
const english = [
  'README.md',
  'docs/AI-IMPORT.md',
  ...userFiles.filter((n) => !n.endsWith('.de.md')).map((n) => `${userDir}/${n}`),
];
const germanOnly = userFiles
  .filter((n) => n.endsWith('.de.md') && !userFiles.includes(n.replace(/\.de\.md$/, '.md')))
  .map((n) => `${userDir}/${n}`);

const problems = germanOnly.map((p) => `${p}: no English source ${englishTwin(p)}`);

const stripCode = (t) => t.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
const relativeLinks = (text) =>
  [...stripCode(text).matchAll(/\]\(([^)\s]+)\)|<a\s[^>]*href="([^"]+)"/g)]
    .map((m) => m[1] ?? m[2])
    .filter((l) => !/^(https?:|mailto:|#)/.test(l))
    .map((l) => l.split('#')[0]);

for (const en of english) {
  const de = en.replace(/\.md$/, '.de.md');
  if (!existsSync(join(repo, de))) {
    problems.push(`${en}: German translation ${de} is missing`);
    continue;
  }
  for (const diff of compareDocs(read(en), read(de))) problems.push(`${en} ↔ ${de}: ${diff}`);

  for (const [file, isGerman] of [
    [en, false],
    [de, true],
  ]) {
    const dir = dirname(join(repo, file));
    for (const link of relativeLinks(read(file))) {
      const target = resolve(dir, decodeURI(link));
      if (!existsSync(target)) {
        problems.push(`${file}: dead link ${link}`);
        continue;
      }
      if (!isGerman || !link.endsWith('.md') || link.endsWith('.de.md')) continue;
      const twin = target.replace(/\.md$/, '.de.md');
      const ownSource = rel(target) === en;
      if (existsSync(twin) && !ownSource)
        problems.push(`${file}: links ${link}, use its German twin ${rel(twin)}`);
    }
  }
}

if (problems.length) {
  console.log(`${problems.length} problem(s) between English docs and German translations:`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log(`OK: ${english.length} English docs and their German translations are in step.`);
