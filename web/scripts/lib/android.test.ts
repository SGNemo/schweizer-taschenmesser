import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findBuildTools, readSigningEnv } from './android';

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function sdk(...versions: string[]): string {
  const home = mkdtempSync(join(tmpdir(), 'sdk-'));
  dirs.push(home);
  for (const v of versions) mkdirSync(join(home, 'build-tools', v), { recursive: true });
  return home;
}

describe('findBuildTools', () => {
  it('picks the newest version by number, not by text', () => {
    const home = sdk('9.0.0', '34.0.0', '35.0.1', '35.0.0');
    expect(findBuildTools(home)).toBe(join(home, 'build-tools', '35.0.1'));
  });

  it('prefers stable versions over previews', () => {
    const home = sdk('34.0.0', '36.0.0-rc1');
    expect(findBuildTools(home)).toBe(join(home, 'build-tools', '34.0.0'));
    expect(findBuildTools(sdk('36.0.0-rc1'))).toContain('36.0.0-rc1');
  });

  it('returns undefined without build tools', () => {
    expect(findBuildTools(sdk())).toBeUndefined();
    expect(findBuildTools(join(tmpdir(), 'does-not-exist'))).toBeUndefined();
  });
});

describe('readSigningEnv', () => {
  const full = {
    ANDROID_KEYSTORE_PATH: '/k.jks',
    ANDROID_KEYSTORE_PASSWORD: 'a',
    ANDROID_KEY_ALIAS: 'taschenmesser',
    ANDROID_KEY_PASSWORD: 'b',
  };

  it('reads a complete configuration', () => {
    expect(readSigningEnv(full)).toEqual({
      keystore: '/k.jks',
      keystorePassword: 'a',
      alias: 'taschenmesser',
      keyPassword: 'b',
    });
  });

  it('names every missing variable', () => {
    expect(
      readSigningEnv({ ...full, ANDROID_KEY_PASSWORD: '', ANDROID_KEY_ALIAS: undefined }),
    ).toEqual(['ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD']);
  });
});
