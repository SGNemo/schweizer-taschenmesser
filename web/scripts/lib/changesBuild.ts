/**
 * Which Dev-Preview build a change note came with. The build number of a preview is the commit count
 * of HEAD (`dev-preview.mjs`), so a note belongs to the build of the commit on `develop` that added its
 * file. Pure: `git` is injected (tests, shallow clones).
 */
import type { ChangeEntry } from './changes.ts';

export type GitRunner = (args: string[]) => string;

/** file name → build number. Empty when history is missing (shallow clone) or git fails. */
export function noteBuilds(files: string[], dir: string, git: GitRunner): Map<string, number> {
  const out = new Map<string, number>();
  try {
    // A shallow clone reports every file as "added" by its one grafted commit: no attribution then.
    if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') return out;
    for (const file of files) {
      const added = git([
        'log',
        '--first-parent',
        '--diff-filter=A',
        '--format=%H',
        '--',
        `${dir}/${file}`,
      ])
        .split('\n')
        .filter(Boolean);
      const first = added.at(-1); // the oldest commit that added it
      if (!first) continue; // not committed yet (local work)
      const n = Number(git(['rev-list', '--count', first]).trim());
      if (Number.isInteger(n) && n > 0) out.set(file, n);
    }
  } catch {
    out.clear();
  }
  return out;
}

/** Entries of all notes with their `build` set where it is known. */
export function entriesWithBuilds(
  byFile: { file: string; entries: ChangeEntry[] }[],
  builds: Map<string, number>,
): ChangeEntry[] {
  return byFile.flatMap(({ file, entries }) => {
    const build = builds.get(file);
    return entries.map((e) => (build ? { ...e, build } : e));
  });
}

/** Entries grouped by build, newest build first; the entries without a build come last. */
export function groupByBuild(
  entries: ChangeEntry[],
): { build: number | undefined; entries: ChangeEntry[] }[] {
  const map = new Map<number | undefined, ChangeEntry[]>();
  for (const e of entries) map.set(e.build, [...(map.get(e.build) ?? []), e]);
  return [...map.entries()]
    .map(([build, list]) => ({ build, entries: list }))
    .sort((a, b) => (b.build ?? -1) - (a.build ?? -1));
}

/**
 * Every build number that exists on `develop` (the commit count at each first-parent commit, newest first)
 * down to `floor`. A push to `develop` is one first-parent commit, so these are the numbers a preview can
 * have; the numbers a merge commit skips never were builds. Empty without history.
 */
export function firstParentBuilds(git: GitRunner, floor: number, max = 1500): number[] {
  const out: number[] = [];
  try {
    if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') return out;
    const hashes = git(['log', '--first-parent', '--format=%H', '-n', String(max)])
      .split('\n')
      .filter(Boolean);
    for (const h of hashes) {
      const n = Number(git(['rev-list', '--count', h]).trim());
      if (!Number.isInteger(n) || n < floor) break;
      out.push(n);
    }
  } catch {
    return [];
  }
  return out;
}
