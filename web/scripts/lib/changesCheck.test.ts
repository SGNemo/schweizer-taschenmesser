import { describe, expect, it } from 'vitest';
import { checkPullRequest } from './changesCheck';
import { wantsUnreleased } from './changelogBuild';

describe('checkPullRequest', () => {
  it('fails without a note', () => {
    expect(checkPullRequest({ changedFiles: ['web/src/a.ts'], labels: [] })).toMatch(
      /No change note/,
    );
  });
  it('accepts a note in .changes/', () => {
    expect(checkPullRequest({ changedFiles: ['.changes/x-fixed.md'], labels: [] })).toBeUndefined();
  });
  it('does not count the README of the folder', () => {
    expect(checkPullRequest({ changedFiles: ['.changes/README.md'], labels: [] })).toMatch(
      /No change/,
    );
  });
  it('accepts the label no-changelog', () => {
    expect(
      checkPullRequest({ changedFiles: ['docs/a.md'], labels: ['no-changelog'] }),
    ).toBeUndefined();
  });
});

describe('wantsUnreleased', () => {
  it('previews show the open notes, stable builds do not', () => {
    expect(wantsUnreleased({ channel: 'dev', version: '1.0.0', serve: false })).toBe(true);
    expect(wantsUnreleased({ version: '1.1.0-beta.2', serve: false })).toBe(true);
    expect(wantsUnreleased({ version: '1.1.0-dev.57+abc1234', serve: false })).toBe(true);
    expect(wantsUnreleased({ version: '1.1.0', serve: true })).toBe(true);
    expect(wantsUnreleased({ channel: 'stable', version: '1.1.0', serve: false })).toBe(false);
  });
});
