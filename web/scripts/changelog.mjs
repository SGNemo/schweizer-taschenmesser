#!/usr/bin/env node
/**
 * Release notes from Conventional Commits.
 *
 *   node scripts/changelog.mjs --version 1.2.0 [--from v1.1.0] [--to HEAD] [--repo <url>] [--out file]
 *
 * Without --from the previous tag is picked automatically: for a release the previous *release*
 * (so notes cover the pre-releases in between), for a pre-release the previous tag of any kind.
 * With no earlier tag the whole history is used.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { compareSemver, isPrerelease, parseSemver } from '../src/core/update/semver.ts';
import { renderChangelog } from './lib/changelog.ts';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc),
      [],
    ),
);
if (!args.version) {
  console.error(
    'Usage: changelog.mjs --version <x.y.z> [--from <tag>] [--to <rev>] [--repo <url>] [--out <file>]',
  );
  process.exit(2);
}

const git = (...a) =>
  execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
const version = args.version.replace(/^v/, '');
const to = args.to ?? 'HEAD';

function previousTag() {
  const tags = git('tag', '--list', 'v*')
    .split('\n')
    .filter((t) => parseSemver(t))
    // Tags that are not ancestors of the range end (other branches) are irrelevant.
    .filter((t) => {
      try {
        git('merge-base', '--is-ancestor', t, to);
        return true;
      } catch {
        return false;
      }
    })
    .filter((t) => compareSemver(t, version) < 0)
    .filter((t) => isPrerelease(version) || !isPrerelease(t));
  return tags.sort(compareSemver).at(-1);
}

const from = args.from ?? previousTag();
const range = from ? `${from}..${to}` : to;
const log = git('log', '--no-merges', '--format=%H%x1f%s%x1f%b%x1e', range);
const commits = log
  .split('\x1e')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((entry) => {
    const [hash, subject, body = ''] = entry.split('\x1f');
    return { hash, subject, body };
  });

const notes = renderChangelog({
  version,
  date: new Date().toISOString().slice(0, 10),
  commits,
  repoUrl: args.repo,
  previousTag: from,
});
if (args.out) writeFileSync(args.out, notes);
else process.stdout.write(notes);
