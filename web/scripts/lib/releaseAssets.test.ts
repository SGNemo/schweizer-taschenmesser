import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RELEASE_ASSETS, assetUrls, releaseAssetNames, unknownAssetLinks } from './releaseAssets';

const root = resolve(__dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('release assets', () => {
  it('extracts asset names from latest and versioned download links', () => {
    const text = `
      [a](https://github.com/o/r/releases/latest/download/Taschenmesser-Portable.exe)
      [b](https://github.com/o/r/releases/download/v1.0.0/Taschenmesser.apk)
      [c](https://github.com/o/r/releases) and https://example.com/x.exe`;
    expect(releaseAssetNames(text).sort()).toEqual([
      'Taschenmesser-Portable.exe',
      'Taschenmesser.apk',
    ]);
  });

  it('flags links to files that no release carries', () => {
    expect(
      unknownAssetLinks('https://github.com/o/r/releases/latest/download/Taschenmesser-Setup.exe'),
    ).toEqual(['Taschenmesser-Setup.exe']);
  });

  it('knows the Dev-Preview files only under the dev-preview tag', () => {
    const base = 'https://github.com/o/r/releases';
    expect(unknownAssetLinks(`${base}/download/dev-preview/Nemo-Portable-dev.exe`)).toEqual([]);
    expect(unknownAssetLinks(`${base}/download/dev-preview/Nemo-dev.apk`)).toEqual([]);
    expect(unknownAssetLinks(`${base}/latest/download/Nemo-dev.apk`)).toEqual(['Nemo-dev.apk']);
    expect(unknownAssetLinks(`${base}/download/v1.0.0/Nemo-dev.apk`)).toEqual(['Nemo-dev.apk']);
    expect(unknownAssetLinks(`${base}/download/dev-preview/Nemo.apk`)).toEqual([]);
  });

  it('README only links to assets a release really has – no leftover installer names', () => {
    const readme = read('README.md');
    expect(unknownAssetLinks(readme)).toEqual([]);
    expect(unknownAssetLinks(read('docs/user/installation.md'))).toEqual([]);
    expect(readme).toContain('releases/latest/download/Nemo-Portable.exe');
    expect(readme).toContain('releases/latest/download/Nemo.apk');
    expect(readme).not.toContain('download/Taschenmesser');
    expect(readme).not.toMatch(/Setup\.exe|\.msi\b/);
  });

  it('the release workflow publishes exactly these files', () => {
    const workflow = read('.github/workflows/release.yml');
    for (const name of RELEASE_ASSETS) expect(workflow, name).toContain(name);
    expect(workflow).not.toMatch(/Setup\.exe|Taschenmesser\.msi/);
  });

  it('no longer publishes the legacy Taschenmesser-* names', () => {
    expect(RELEASE_ASSETS.join(' ')).not.toContain('Taschenmesser');
    expect(read('.github/workflows/release.yml')).not.toMatch(/Taschenmesser[-.]/);
  });

  it('builds the URLs the post-release check requests', () => {
    const beta = assetUrls('o/r', 'v1.0.0-beta.1', { stable: false });
    expect(beta).toHaveLength(RELEASE_ASSETS.length);
    expect(beta[0]).toBe(
      'https://github.com/o/r/releases/download/v1.0.0-beta.1/Nemo-Portable.exe',
    );
    const stable = assetUrls('o/r', 'v1.0.0', { stable: true });
    expect(stable).toHaveLength(RELEASE_ASSETS.length * 2);
    expect(stable.at(-1)).toContain('/releases/latest/download/latest.json');
  });
});

describe('assetUrls', () => {
  it('pre-releases only check the tag URLs, never latest/download', () => {
    const urls = assetUrls('o/r', 'v0.3.0-beta.1', { stable: false });
    expect(urls).toHaveLength(RELEASE_ASSETS.length);
    expect(
      urls.every((u) => u.startsWith('https://github.com/o/r/releases/download/v0.3.0-beta.1/')),
    ).toBe(true);
    expect(urls.some((u) => u.includes('/latest/'))).toBe(false);
    expect(urls).toContain(
      'https://github.com/o/r/releases/download/v0.3.0-beta.1/Nemo-Portable.exe',
    );
  });

  it('stable releases additionally check the latest links', () => {
    const urls = assetUrls('o/r', 'v1.0.0', { stable: true });
    expect(urls).toHaveLength(RELEASE_ASSETS.length * 2);
    expect(urls).toContain('https://github.com/o/r/releases/latest/download/Nemo.apk');
  });
});
