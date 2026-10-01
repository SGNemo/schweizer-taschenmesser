import { describe, expect, it } from 'vitest';
import { parseArgs } from './args';

describe('parseArgs', () => {
  it('reads flags with a value', () => {
    expect(parseArgs(['--repo', 'a/b', '--tag', 'v1.2.3'])).toEqual({ repo: 'a/b', tag: 'v1.2.3' });
  });

  it('treats a trailing flag as boolean', () => {
    expect(parseArgs(['--repo', 'a/b', '--tag', 'v1.2.3', '--stable'])).toEqual({
      repo: 'a/b',
      tag: 'v1.2.3',
      stable: true,
    });
  });

  it('treats a flag in the middle as boolean and keeps the following values', () => {
    expect(parseArgs(['--repo', 'a/b', '--stable', '--tag', 'v1.2.3'])).toEqual({
      repo: 'a/b',
      stable: true,
      tag: 'v1.2.3',
    });
  });

  it('supports --name=value', () => {
    expect(parseArgs(['--repo=a/b', '--tag=v1.2.3'])).toEqual({ repo: 'a/b', tag: 'v1.2.3' });
    expect(parseArgs(['--out=x=y'])).toEqual({ out: 'x=y' });
  });

  it('gives true for a flag without a value', () => {
    expect(parseArgs(['--repo'])).toEqual({ repo: true });
    expect(parseArgs(['--repo', '--tag', 'v1'])).toEqual({ repo: true, tag: 'v1' });
  });

  it('handles an empty list and ignores stray values', () => {
    expect(parseArgs([])).toEqual({});
    expect(parseArgs(['stray', '--a', '1'])).toEqual({ a: '1' });
  });
});
