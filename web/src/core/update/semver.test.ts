import { describe, expect, it } from 'vitest';
import { androidVersionCode, compareSemver, isNewer, isPrerelease, parseSemver } from './semver';

describe('parseSemver', () => {
  it('parses releases, pre-releases, a leading v and ignores build metadata', () => {
    expect(parseSemver('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] });
    expect(parseSemver('v0.10.0-beta.2+abc.1')).toEqual({
      major: 0,
      minor: 10,
      patch: 0,
      prerelease: ['beta', 2],
    });
  });

  it.each(['', '1', '1.2', '1.2.3.4', '01.2.3', '1.2.3-', '1.2.3-01', 'a.b.c', '1.2.3-beta..1'])(
    'rejects "%s"',
    (bad) => expect(parseSemver(bad)).toBeUndefined(),
  );
});

describe('compareSemver (SemVer §11 examples)', () => {
  const ordered = [
    '1.0.0-alpha',
    '1.0.0-alpha.1',
    '1.0.0-alpha.beta',
    '1.0.0-beta',
    '1.0.0-beta.2',
    '1.0.0-beta.11',
    '1.0.0-rc.1',
    '1.0.0',
    '1.0.1',
    '1.1.0',
    '2.0.0',
  ];

  it('orders the reference list ascending', () => {
    for (let i = 0; i < ordered.length; i++) {
      for (let j = 0; j < ordered.length; j++) {
        expect(compareSemver(ordered[i]!, ordered[j]!), `${ordered[i]} vs ${ordered[j]}`).toBe(
          i === j ? 0 : i < j ? -1 : 1,
        );
      }
    }
  });

  it('numeric parts compare as numbers, not text', () => {
    expect(compareSemver('1.10.0', '1.9.0')).toBe(1);
    expect(isNewer('0.10.0', '0.9.9')).toBe(true);
  });

  it('ignores build metadata and a leading v', () => {
    expect(compareSemver('v1.0.0+1', '1.0.0+2')).toBe(0);
  });

  it('isNewer / isPrerelease', () => {
    expect(isNewer('1.0.0', '1.0.0-rc.1')).toBe(true);
    expect(isNewer('1.0.0-rc.1', '1.0.0')).toBe(false);
    expect(isNewer('1.0.0', '1.0.0')).toBe(false);
    expect(isPrerelease('1.0.0-beta.1')).toBe(true);
    expect(isPrerelease('1.0.0')).toBe(false);
  });

  it('throws on invalid input instead of guessing', () => {
    expect(() => compareSemver('nope', '1.0.0')).toThrow(/not a valid semver/i);
  });
});

describe('androidVersionCode', () => {
  it('follows the documented formula', () => {
    expect(androidVersionCode('0.1.0')).toBe(100099);
    expect(androidVersionCode('1.2.3')).toBe(1002003 * 100 + 99);
    expect(androidVersionCode('0.2.0-beta.1')).toBe(200031);
    expect(androidVersionCode('1.0.0-alpha.3')).toBe(1000000 * 100 + 3);
    expect(androidVersionCode('1.0.0-rc.2')).toBe(1000000 * 100 + 62);
  });

  it('is strictly increasing in SemVer order', () => {
    const ordered = [
      '0.1.0',
      '0.2.0-alpha.1',
      '0.2.0-alpha.2',
      '0.2.0-beta.1',
      '0.2.0-beta.2',
      '0.2.0-rc.1',
      '0.2.0',
      '0.2.1',
      '0.10.0',
      '1.0.0-beta.1',
      '1.0.0',
      '20.999.999',
    ];
    const codes = ordered.map(androidVersionCode);
    expect(codes).toEqual([...codes].sort((a, b) => a - b));
    expect(new Set(codes).size).toBe(codes.length);
    expect(Math.max(...codes)).toBeLessThan(2_100_000_000);
  });

  it('rejects what it cannot order safely', () => {
    expect(() => androidVersionCode('1.0.0-foo.1')).toThrow(/not supported/);
    expect(() => androidVersionCode('1.0.0-beta.1.2')).toThrow(/not supported/);
    expect(() => androidVersionCode('21.0.0')).toThrow(/range/);
    expect(() => androidVersionCode('1.1000.0')).toThrow(/range/);
  });
});
