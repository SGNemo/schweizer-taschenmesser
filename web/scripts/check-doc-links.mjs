#!/usr/bin/env node
/**
 * `npm run check:doclinks`: links, pictures and anchors of the README, the community files and the user
 * docs. The website has its own check (`npm run check:links` in site/, it follows the built pages).
 *
 *   node scripts/check-doc-links.mjs                 relative links, anchors, pictures, alt texts, heading levels
 *   node scripts/check-doc-links.mjs --external      also asks every external address (HEAD-less, 1 byte)
 *   node scripts/check-doc-links.mjs --external --strict   an unreachable address fails too
 *   node scripts/check-doc-links.mjs README.md docs/user/faq.md   only these files
 *
 * Exit 1 when a relative link, an anchor or a picture is missing, a picture has no alt text, a README
 * skips a heading level, or an external address answers 404/410. Other answers (403, 429, 5xx) and
 * addresses that cannot be reached from here (a network without internet) are warnings, because
 * they say nothing about the page itself.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  anchors,
  extractLinks,
  headingSkips,
  imagesWithoutAlt,
  isExternal,
  isSkipped,
  splitTarget,
} from './lib/docLinks.ts';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const external = args.includes('--external');
const strict = args.includes('--strict');
const given = args.filter((a) => !a.startsWith('--'));

const list = (dir, test) =>
  existsSync(join(repo, dir))
    ? readdirSync(join(repo, dir))
        .filter(test)
        .map((n) => `${dir}/${n}`)
    : [];
const files = given.length
  ? given
  : [
      ...list('.', (n) =>
        /^(README|CONTRIBUTING|SECURITY|SUPPORT|CODE_OF_CONDUCT|CHANGELOG)(\.de)?\.md$/.test(n),
      ).map((f) => f.replace(/^\.\//, '')),
      'docs/README.md',
      ...list('docs', (n) => /^AI-IMPORT(\.de)?\.md$/.test(n)),
      ...list('docs/user', (n) => n.endsWith('.md')),
      'site/README.md',
      '.github/PULL_REQUEST_TEMPLATE.md',
    ];

const problems = [];
const warnings = [];
const read = (f) => readFileSync(join(repo, f), 'utf8');
const anchorCache = new Map();
const anchorsOf = (f) => {
  if (!anchorCache.has(f)) anchorCache.set(f, anchors(read(f)));
  return anchorCache.get(f);
};
const externalUrls = new Map();

for (const file of files) {
  if (!existsSync(join(repo, file))) {
    problems.push(`${file}: file not found`);
    continue;
  }
  const text = read(file);
  for (const { target, kind } of extractLinks(text)) {
    if (isSkipped(target)) continue;
    if (isExternal(target)) {
      if (kind === 'link' || !target.includes('{')) {
        externalUrls.set(target, [...(externalUrls.get(target) ?? []), file]);
      }
      continue;
    }
    const { path, anchor } = splitTarget(target);
    const abs =
      path === ''
        ? join(repo, file)
        : path.startsWith('/')
          ? join(repo, path)
          : resolve(dirname(join(repo, file)), path);
    const rel = relative(repo, abs);
    if (!existsSync(abs)) {
      problems.push(`${file}: dead ${kind} ${target}`);
      continue;
    }
    if (kind === 'image' && statSync(abs).isFile() && statSync(abs).size === 0)
      problems.push(`${file}: empty picture ${target}`);
    if (
      anchor &&
      abs.endsWith('.md') &&
      !anchorsOf(rel).has(anchor.toLowerCase()) &&
      !anchorsOf(rel).has(anchor)
    ) {
      problems.push(`${file}: no anchor #${anchor} in ${rel}`);
    }
  }
  for (const src of imagesWithoutAlt(text))
    problems.push(`${file}: picture without alt text ${src}`);
  if (/^README(\.de)?\.md$|^docs\/user\//.test(file)) {
    for (const skip of headingSkips(text)) problems.push(`${file}: heading level skipped: ${skip}`);
  }
}

if (external) {
  const urls = [...externalUrls.keys()];
  const results = new Map();
  const ask = async (url) => {
    let last = 'unreachable';
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { range: 'bytes=0-0', 'user-agent': 'nemo-doc-link-check' },
          redirect: 'follow',
          signal: AbortSignal.timeout(15_000),
        });
        await res.arrayBuffer().catch(() => undefined);
        return res.status;
      } catch (e) {
        last = e instanceof Error ? e.message : String(e);
      }
    }
    return last;
  };
  const queue = [...urls];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let url = queue.shift(); url; url = queue.shift()) results.set(url, await ask(url));
    }),
  );
  let ok = 0;
  for (const url of urls) {
    const r = results.get(url);
    const where = [...new Set(externalUrls.get(url))].join(', ');
    if (typeof r === 'number' && ((r >= 200 && r < 400) || r === 206)) ok++;
    else if (r === 404 || r === 410) problems.push(`${where}: ${r} ${url}`);
    else if (typeof r === 'number')
      warnings.push(`${where}: HTTP ${r} (not a verdict, some hosts refuse scripts) ${url}`);
    else (strict ? problems : warnings).push(`${where}: unreachable from here (${r}) ${url}`);
  }
  console.log(`External: ${ok} of ${urls.length} addresses answered.`);
}

for (const w of warnings) console.warn(`warning: ${w}`);
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  console.error(`${problems.length} problem(s) in ${files.length} files.`);
  process.exit(1);
}
console.log(
  `OK: ${files.length} files, ${externalUrls.size} external addresses${external ? ' checked' : ' (not asked; use --external)'}.`,
);
