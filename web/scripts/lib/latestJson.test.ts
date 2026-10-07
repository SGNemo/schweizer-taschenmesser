import { describe, expect, it } from 'vitest';
import { UPDATER_PORTABLE_ASSET, buildLatestJson } from './latestJson';

const base = {
  version: '1.2.0',
  notes: '\n## 1.2.0\n- thing\n',
  pubDate: '2026-10-01T10:00:00Z',
  repo: 'SGNemo/schweizer-taschenmesser',
  tag: 'v1.2.0',
};
const portable = {
  fileName: UPDATER_PORTABLE_ASSET,
  signature: 'dW50cnVzdGVkIGNvbW1lbnQ=\n',
};

describe('buildLatestJson', () => {
  it('the manifest asset is the legacy name installed apps look for', () => {
    expect(UPDATER_PORTABLE_ASSET).toBe('Nemo-Portable.exe');
  });

  it('points at the versioned asset URL of this release', () => {
    const json = buildLatestJson({ ...base, portable });
    expect(json.platforms['windows-x86_64-portable']).toEqual({
      signature: 'dW50cnVzdGVkIGNvbW1lbnQ=',
      url: 'https://github.com/SGNemo/schweizer-taschenmesser/releases/download/v1.2.0/Nemo-Portable.exe',
    });
    expect(JSON.stringify(json)).not.toContain('/latest/');
  });

  it('builds the Dev-Preview manifest on the rolling tag with the dev exe', () => {
    const json = buildLatestJson({
      ...base,
      version: '1.2.1-dev.57',
      tag: 'dev-preview',
      portable: { ...portable, fileName: 'Nemo-Portable-dev.exe' },
    });
    expect(json.version).toBe('1.2.1-dev.57');
    expect(json.platforms['windows-x86_64-portable']!.url).toBe(
      'https://github.com/SGNemo/schweizer-taschenmesser/releases/download/dev-preview/Nemo-Portable-dev.exe',
    );
  });

  it('has no generic or installer entries an old installed app could pick up', () => {
    const keys = Object.keys(buildLatestJson({ ...base, portable }).platforms);
    expect(keys).toEqual(['windows-x86_64-portable']);
  });

  it('carries version, trimmed notes and publication date', () => {
    const json = buildLatestJson({ ...base, portable });
    expect(json).toMatchObject({ version: '1.2.0', pub_date: '2026-10-01T10:00:00Z' });
    expect(json.notes).toBe('## 1.2.0\n- thing');
  });

  it('refuses to build a manifest the updater could not verify', () => {
    expect(() => buildLatestJson({ ...base })).toThrow(/portable/);
    expect(() =>
      buildLatestJson({ ...base, portable: { fileName: 'x.exe', signature: '  ' } }),
    ).toThrow(/Empty signature/);
  });

  it('encodes unusual file names', () => {
    const json = buildLatestJson({ ...base, portable: { fileName: 'A B.exe', signature: 's' } });
    expect(json.platforms['windows-x86_64-portable']!.url.endsWith('/A%20B.exe')).toBe(true);
  });
});
