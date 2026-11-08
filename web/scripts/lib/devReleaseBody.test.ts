import { describe, expect, it } from 'vitest';
import { devInstallBlock, INSTALL_PAGE } from './devReleaseBody';

const H = (c: string) => c.repeat(64);
const files = [
  { name: 'Nemo-Portable-dev.exe', sha256: H('a') },
  { name: 'Nemo-dev.apk', sha256: H('b') },
  { name: 'dev-latest.json', sha256: H('c') },
];

describe('devInstallBlock', () => {
  const body = devInstallBlock('SGNemo/schweizer-taschenmesser', 'dev-preview', files);

  it('puts the download links first', () => {
    expect(body.startsWith('## Download\n')).toBe(true);
    expect(body).toContain(
      'https://github.com/SGNemo/schweizer-taschenmesser/releases/download/dev-preview/Nemo-Portable-dev.exe',
    );
    expect(body.indexOf('Nemo-dev.apk')).toBeLessThan(body.indexOf('### Windows'));
  });

  it('carries both short guides with the exact button labels in German and English', () => {
    for (const label of [
      'Weitere Informationen',
      'Trotzdem ausführen',
      'More info',
      'Run anyway',
    ]) {
      expect(body).toContain(`**${label}**`);
    }
    for (const label of [
      'Von dieser Quelle zulassen',
      'Allow from this source',
      'Installieren',
      'Install',
    ]) {
      expect(body).toContain(`**${label}**`);
    }
    expect(body).toContain(INSTALL_PAGE.de);
    expect(body).toContain(INSTALL_PAGE.en);
  });

  it('lists the SHA-256 of every file', () => {
    for (const f of files) expect(body).toContain(`| \`${f.name}\` | \`${f.sha256}\` |`);
  });

  it('refuses malformed hashes, a missing exe/APK and odd repository names', () => {
    expect(() =>
      devInstallBlock('a/b', 't', [{ ...files[0]!, sha256: 'xyz' }, files[1]!]),
    ).toThrow();
    expect(() => devInstallBlock('a/b', 't', [files[1]!])).toThrow(/Nemo-Portable-dev.exe/);
    expect(() => devInstallBlock('a b', 't', files)).toThrow();
  });
});
