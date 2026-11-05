import { describe, expect, it } from 'vitest';
import type { ChangeEntry } from './changes';
import { renderBuilds } from './changelogRelease';
import {
  entriesWithBuilds,
  firstParentBuilds,
  groupByBuild,
  noteBuilds,
  type GitRunner,
} from './changesBuild';

const e = (p: Partial<ChangeEntry>): ChangeEntry => ({
  type: 'added',
  area: 'calendar',
  breaking: false,
  highlight: false,
  de: 'Deutsch',
  en: 'English',
  ...p,
});

/** A fake repository: file → hashes that added it (newest first), hash → commit count. */
function fakeGit(opts: {
  shallow?: boolean;
  added: Record<string, string[]>;
  counts: Record<string, number>;
}): GitRunner {
  return (args) => {
    if (args[0] === 'rev-parse') return opts.shallow ? 'true\n' : 'false\n';
    if (args[0] === 'log')
      return (opts.added[args.at(-1)!.replace('.changes/', '')] ?? []).join('\n');
    if (args[0] === 'rev-list') return `${opts.counts[args.at(-1)!]}\n`;
    throw new Error(`unexpected ${args.join(' ')}`);
  };
}

describe('noteBuilds', () => {
  const git = fakeGit({
    added: { 'a.md': ['h2', 'h1'], 'b.md': ['h3'], 'local.md': [] },
    counts: { h1: 686, h2: 690, h3: 687 },
  });
  it('takes the oldest commit that added the file and its commit count as the build', () => {
    const m = noteBuilds(['a.md', 'b.md', 'local.md'], '.changes', git);
    expect(m.get('a.md')).toBe(686);
    expect(m.get('b.md')).toBe(687);
    expect(m.has('local.md')).toBe(false); // not committed yet
  });
  it('gives no attribution in a shallow clone (every file would look added by the one grafted commit)', () => {
    const shallow = fakeGit({ shallow: true, added: { 'a.md': ['h1'] }, counts: { h1: 1 } });
    expect(noteBuilds(['a.md'], '.changes', shallow).size).toBe(0);
  });
  it('gives no attribution when git fails', () => {
    expect(
      noteBuilds(['a.md'], '.changes', () => {
        throw new Error('no git');
      }).size,
    ).toBe(0);
  });
});

describe('build grouping', () => {
  const entries = entriesWithBuilds(
    [
      { file: 'a.md', entries: [e({ en: 'one' }), e({ en: 'two' })] },
      { file: 'b.md', entries: [e({ en: 'three' })] },
      { file: 'local.md', entries: [e({ en: 'local' })] },
    ],
    new Map([
      ['a.md', 686],
      ['b.md', 688],
    ]),
  );
  it('groups newest build first, notes without a build last', () => {
    expect(groupByBuild(entries).map((g) => [g.build, g.entries.map((x) => x.en)])).toEqual([
      [688, ['three']],
      [686, ['one', 'two']],
      [undefined, ['local']],
    ]);
  });
  it('renders one "## Build N" section per build in each language, then Unreleased', () => {
    const en = renderBuilds(entries, 'en');
    expect(en.indexOf('## Build 688')).toBeLessThan(en.indexOf('## Build 686'));
    expect(en.indexOf('## Build 686')).toBeLessThan(en.indexOf('## Unreleased'));
    expect(en).toContain('- **Calendar:** three');
    expect(renderBuilds(entries, 'de')).toContain('- **Kalender:** Deutsch');
  });
});

describe('firstParentBuilds', () => {
  const git: GitRunner = (args) => {
    if (args[0] === 'rev-parse') return 'false\n';
    if (args[0] === 'log') return 'c5\nc4\nc3\nc2\nc1\n';
    return `${{ c5: 730, c4: 727, c3: 723, c2: 714, c1: 711 }[args.at(-1)!]}\n`;
  };
  it('lists the build number of every first-parent commit down to the floor, newest first', () => {
    expect(firstParentBuilds(git, 714)).toEqual([730, 727, 723, 714]);
  });
  it('is empty in a shallow clone or when git fails', () => {
    expect(firstParentBuilds(() => 'true\n', 1)).toEqual([]);
    expect(
      firstParentBuilds(() => {
        throw new Error('x');
      }, 1),
    ).toEqual([]);
  });
  it('renders every build number as a heading, also those without notes', () => {
    const en = renderBuilds([e({ en: 'one', build: 727 })], 'en', [730, 727, 723]);
    expect(en.indexOf('## Build 730')).toBeLessThan(en.indexOf('## Build 727'));
    expect(en.indexOf('## Build 727')).toBeLessThan(en.indexOf('## Build 723'));
    expect(en).toContain('- **Calendar:** one');
  });
});
