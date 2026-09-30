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

  it('README only links to assets a release really has – no leftover installer names', () => {
    const readme = read('README.md');
    expect(unknownAssetLinks(readme)).toEqual([]);
    expect(unknownAssetLinks(read('docs/user/installation.md'))).toEqual([]);
    // The latest *stable* release (v0.2.0) predates the rename and only carries the legacy names, so
    // the download buttons use them. Switch to `Nemo-*` with the first stable release that has both
    // (docs/STATUS.md, "Offen – macht Sven", item 11).
    expect(readme).toContain('releases/latest/download/Taschenmesser-Portable.exe');
    expect(readme).toContain('releases/latest/download/Taschenmesser.apk');
    expect(readme).not.toMatch(/Setup\.exe|\.msi\b/);
  });

  it('the release workflow publishes exactly these files', () => {
    const workflow = read('.github/workflows/release.yml');
    for (const name of RELEASE_ASSETS) expect(workflow, name).toContain(name);
    expect(workflow).not.toMatch(/Setup\.exe|Taschenmesser\.msi/);
  });

  it('keeps the legacy names installed apps look for (updater transition)', () => {
    expect(RELEASE_ASSETS).toContain('Taschenmesser-Portable.exe');
    expect(RELEASE_ASSETS).toContain('Taschenmesser.apk');
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
