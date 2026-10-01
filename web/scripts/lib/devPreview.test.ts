import { describe, expect, it } from 'vitest';
import { compareSemver } from '../../src/core/update/semver';
import {
  DEV_ASSETS,
  DEV_TAG,
  devAssetUrls,
  devVersion,
  devVersionCode,
  devVersionFull,
  isDevNewer,
  nextBaseVersion,
} from './devPreview';

describe('nextBaseVersion', () => {
  it('uses package.json while its version is not released yet', () => {
    expect(nextBaseVersion('0.4.0', ['v0.3.1'])).toBe('0.4.0');
  });
  it('bumps the patch once the stable tag exists', () => {
    expect(nextBaseVersion('0.3.1', ['v0.3.0', 'v0.3.1', 'v0.3.1-beta.1'])).toBe('0.3.2');
    expect(nextBaseVersion('0.3.1', ['v0.3.1', 'v0.3.2'])).toBe('0.3.3');
  });
  it('keeps the base of a pre-release in package.json', () => {
    expect(nextBaseVersion('0.4.0-beta.1', ['v0.3.1'])).toBe('0.4.0');
  });
  it('rejects garbage', () => {
    expect(() => nextBaseVersion('x', [])).toThrow();
  });
});

describe('dev versions', () => {
  it('are valid SemVer, below the next stable and above the last one', () => {
    const v = devVersion('0.3.2', 57);
    expect(v).toBe('0.3.2-dev.57');
    expect(compareSemver(v, '0.3.2')).toBe(-1);
    expect(compareSemver(v, '0.3.1')).toBe(1);
  });
  it('increase with the build number, also across digit counts', () => {
    expect(isDevNewer(devVersion('0.3.2', 58), devVersion('0.3.2', 57))).toBe(true);
    expect(isDevNewer(devVersion('0.3.2', 100), devVersion('0.3.2', 99))).toBe(true);
    expect(isDevNewer(devVersion('0.3.2', 9), devVersion('0.3.2', 10))).toBe(false);
  });
  it('after a stable release the next previews are above the old ones', () => {
    expect(isDevNewer(devVersion('0.3.3', 120), devVersion('0.3.2', 119))).toBe(true);
  });
  it('rejects a bad build number', () => {
    expect(() => devVersion('0.3.2', 0)).toThrow();
    expect(() => devVersion('0.3.2', 1.5)).toThrow();
  });
  it('full version carries the short commit id and still compares equal to the plain one', () => {
    const full = devVersionFull('0.3.2-dev.57', 'ABCDEF0123456789');
    expect(full).toBe('0.3.2-dev.57+ABCDEF0');
    expect(compareSemver(full, '0.3.2-dev.57')).toBe(0);
    expect(() => devVersionFull('0.3.2-dev.57', 'xyz')).toThrow();
  });
});

describe('devVersionCode', () => {
  it('increases strictly with time and stays in range', () => {
    const a = devVersionCode(Date.UTC(2026, 9, 1, 12, 0));
    const b = devVersionCode(Date.UTC(2026, 9, 1, 12, 1));
    const c = devVersionCode(Date.UTC(2027, 0, 1));
    expect(b).toBe(a + 1);
    expect(c).toBeGreaterThan(b);
    expect(c).toBeLessThan(2_100_000_000);
  });
  it('rejects nonsense', () => {
    expect(() => devVersionCode(0)).toThrow();
    expect(() => devVersionCode(Number.NaN)).toThrow();
  });
});

describe('dev assets', () => {
  it('live under the dev-preview tag only', () => {
    expect(DEV_TAG).toBe('dev-preview');
    expect(DEV_TAG).not.toMatch(/^v\d/);
    for (const url of devAssetUrls('o/r')) {
      expect(url).toContain('/releases/download/dev-preview/');
    }
    expect(DEV_ASSETS).toContain('dev-latest.json');
  });
});
