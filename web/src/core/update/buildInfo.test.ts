import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectiveChannel } from './buildInfo';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('effectiveChannel', () => {
  it('stable builds follow the stored preference and can never reach dev', () => {
    expect(effectiveChannel('stable', 'stable')).toBe('stable');
    expect(effectiveChannel('beta', 'stable')).toBe('beta');
  });
  it('a Dev-Preview build always follows the dev channel', () => {
    expect(effectiveChannel('stable', 'dev')).toBe('dev');
    expect(effectiveChannel('beta', 'dev')).toBe('dev');
  });
  it('this test build is a stable build', async () => {
    const info = await import('./buildInfo');
    expect(info.BUILD_CHANNEL).toBe('stable');
    expect(info.BUILD_SHA).toBe('');
  });
  it('only the dev workflow flags switch a build to dev (and expose the short commit id)', async () => {
    vi.stubEnv('VITE_RELEASE_CHANNEL', 'dev');
    vi.stubEnv('VITE_BUILD_SHA', 'abcdef0123456789');
    vi.resetModules();
    const info = await import('./buildInfo');
    expect(info.BUILD_CHANNEL).toBe('dev');
    expect(info.BUILD_SHA).toBe('abcdef0');
    expect(info.effectiveChannel('stable')).toBe('dev');
  });
  it('any other value stays stable', async () => {
    vi.stubEnv('VITE_RELEASE_CHANNEL', 'beta');
    vi.resetModules();
    expect((await import('./buildInfo')).BUILD_CHANNEL).toBe('stable');
  });
});
