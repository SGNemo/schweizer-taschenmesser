import { describe, expect, it } from 'vitest';
import { parseCommit, renderChangelog, type RawCommit } from './changelog';

const c = (subject: string, body = '', hash = 'abcdef1234567890'): RawCommit => ({
  hash,
  subject,
  body,
});

describe('parseCommit', () => {
  it('parses type, scope, breaking marker and description', () => {
    expect(parseCommit(c('feat(vault): add TOTP codes'))).toMatchObject({
      type: 'feat',
      scope: 'vault',
      description: 'add TOTP codes',
      breaking: false,
    });
    expect(parseCommit(c('fix!: drop legacy backup format'))).toMatchObject({
      type: 'fix',
      breaking: true,
    });
    expect(
      parseCommit(c('refactor: rework sync', 'details\n\nBREAKING CHANGE: sync epochs changed')),
    ).toMatchObject({ breaking: true, breakingNote: 'sync epochs changed' });
  });

  it('rejects free-form subjects', () => {
    expect(parseCommit(c('Phase 4: sync server'))).toBeUndefined();
    expect(parseCommit(c('feat add things'))).toBeUndefined();
    expect(parseCommit(c('feat(): x'))).toBeUndefined();
  });
});

describe('renderChangelog', () => {
  const repoUrl = 'https://github.com/o/r';

  it('groups by type, links commits and puts breaking changes first', () => {
    const md = renderChangelog({
      version: '1.2.0',
      date: '2026-10-01',
      repoUrl,
      previousTag: 'v1.1.0',
      commits: [
        c('feat(ai): add Groq', '', 'a'.repeat(40)),
        c('fix(sync): keep tombstones', '', 'b'.repeat(40)),
        c('feat!: new backup format', 'BREAKING CHANGE: old files need re-export', 'c'.repeat(40)),
        c('perf: faster search', '', 'd'.repeat(40)),
        c('docs: readme', '', 'e'.repeat(40)),
        c('ci: cache cargo', '', 'f'.repeat(40)),
      ],
    });
    expect(md.startsWith('## 1.2.0 (2026-10-01)')).toBe(true);
    expect(md.indexOf('Breaking changes')).toBeLessThan(md.indexOf('### Features'));
    expect(md.indexOf('### Features')).toBeLessThan(md.indexOf('### Bug fixes'));
    expect(md).toContain(
      '- **ai:** add Groq ([`aaaaaaa`](https://github.com/o/r/commit/' + 'a'.repeat(40) + '))',
    );
    expect(md).toContain('old files need re-export');
    expect(md).toContain('### Build & CI');
    expect(md).toContain('https://github.com/o/r/compare/v1.1.0...v1.2.0');
  });

  it('hides chore/test/style and merge/release commits', () => {
    const md = renderChangelog({
      version: '1.0.1',
      date: '2026-10-02',
      commits: [
        c('chore: bump deps'),
        c('test: more tests'),
        c('style: format'),
        c('Merge branch develop'),
        c('chore(release): 1.0.1'),
        c('fix: real fix'),
      ],
    });
    expect(md).toContain('real fix');
    expect(md).not.toMatch(/bump deps|more tests|format|Merge|release/);
  });

  it('keeps non-conventional history visible under "Other changes"', () => {
    const md = renderChangelog({
      version: '0.2.0-beta.1',
      date: '2026-10-03',
      commits: [c('Phase 5: AI assistant'), c('feat: shiny')],
    });
    expect(md).toContain('### Other changes');
    expect(md).toContain('- Phase 5: AI assistant');
  });

  it('says so when nothing user-facing changed', () => {
    expect(
      renderChangelog({ version: '1.0.1', date: '2026-10-02', commits: [c('chore: x')] }),
    ).toContain('No user-facing changes');
  });
});
