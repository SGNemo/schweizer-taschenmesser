import { describe, expect, it } from 'vitest';
import { buildLatestJson } from './latestJson';

const base = {
  version: '1.2.0',
  notes: '\n## 1.2.0\n- thing\n',
  pubDate: '2026-10-01T10:00:00Z',
  repo: 'SGNemo/schweizer-taschenmesser',
  tag: 'v1.2.0',
};
const nsis = { fileName: 'Taschenmesser-Setup.exe', signature: 'dW50cnVzdGVkIGNvbW1lbnQ=\n' };
const msi = { fileName: 'Taschenmesser.msi', signature: 'c2lnLW1zaQ==' };

describe('buildLatestJson', () => {
  it('points at the versioned asset URLs of this release', () => {
    const json = buildLatestJson({ ...base, nsis, msi });
    expect(json.platforms['windows-x86_64-nsis']).toEqual({
      signature: 'dW50cnVzdGVkIGNvbW1lbnQ=',
      url: 'https://github.com/SGNemo/schweizer-taschenmesser/releases/download/v1.2.0/Taschenmesser-Setup.exe',
    });
    expect(json.platforms['windows-x86_64-msi']!.url).toMatch(
      /\/download\/v1\.2\.0\/Taschenmesser\.msi$/,
    );
    expect(JSON.stringify(json)).not.toContain('/latest/');
  });

  it('uses the NSIS setup as the generic Windows entry, else the MSI', () => {
    expect(buildLatestJson({ ...base, nsis, msi }).platforms['windows-x86_64']!.url).toContain(
      'Setup.exe',
    );
    const onlyMsi = buildLatestJson({ ...base, msi });
    expect(onlyMsi.platforms['windows-x86_64']!.url).toContain('.msi');
    expect(Object.keys(onlyMsi.platforms)).toEqual(['windows-x86_64', 'windows-x86_64-msi']);
  });

  it('carries version, trimmed notes and publication date', () => {
    const json = buildLatestJson({ ...base, nsis });
    expect(json).toMatchObject({ version: '1.2.0', pub_date: '2026-10-01T10:00:00Z' });
    expect(json.notes).toBe('## 1.2.0\n- thing');
  });

  it('refuses to build a manifest the updater could not verify', () => {
    expect(() => buildLatestJson({ ...base })).toThrow(/at least one/);
    expect(() =>
      buildLatestJson({ ...base, nsis: { fileName: 'x.exe', signature: '  ' } }),
    ).toThrow(/Empty signature/);
  });

  it('encodes unusual file names', () => {
    const json = buildLatestJson({ ...base, nsis: { fileName: 'A B.exe', signature: 's' } });
    expect(json.platforms['windows-x86_64']!.url.endsWith('/A%20B.exe')).toBe(true);
  });
});
