import { describe, expect, it } from 'vitest';
import { capReleaseBody, devInstallBlock, INSTALL_PAGE, MAX_RELEASE_BODY } from './devReleaseBody';

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

describe('capReleaseBody', () => {
  const head = devInstallBlock('SGNemo/schweizer-taschenmesser', 'dev-preview', files);
  const repo = 'SGNemo/schweizer-taschenmesser';
  const half = (lang: string, from: number, to: number) =>
    Array.from({ length: from - to + 1 }, (_, i) => from - i)
      .map((n) => `## Build ${n}\n\n### ${lang}\n- ${lang} entry ${n} ${'x'.repeat(400)}`)
      .join('\n\n') + '\n';
  const notes = (from: number, to: number) =>
    `> **Dev-Preview** – intro\n\n${half('Neu', from, to)}\n---\n\n${half('New', from, to)}`;

  it('leaves a body under the cap unchanged', () => {
    const n = notes(10, 1);
    expect(capReleaseBody(head, n, repo)).toBe(head + n);
  });

  it('caps a long body below the limit, newest builds first, whole sections in both languages', () => {
    const n = notes(2892, 2600); // ~250,000 characters, far above GitHub's 125,000
    expect(head.length + n.length).toBeGreaterThan(125_000);
    const body = capReleaseBody(head, n, repo);
    expect(body.length).toBeLessThanOrEqual(MAX_RELEASE_BODY);
    expect(body.startsWith(head + '> **Dev-Preview** – intro')).toBe(true);
    const de = body.slice(0, body.lastIndexOf('\n---\n'));
    const en = body.slice(body.lastIndexOf('\n---\n'));
    const builds = (s: string) => [...s.matchAll(/^## Build (\d+)$/gm)].map((m) => Number(m[1]));
    expect(builds(de)[0]).toBe(2892);
    expect(builds(en)).toEqual(builds(de));
    expect(builds(de)).toEqual([...builds(de)].sort((a, b) => b - a));
    expect(builds(de).length).toBeGreaterThan(50);
    expect(body).not.toContain('## Build 2600');
    // never cut mid-entry: every kept heading carries its full entry
    for (const b of builds(en)) expect(en).toContain(`- New entry ${b} ${'x'.repeat(400)}`);
    expect(body.trimEnd().split('\n').at(-1)).toContain(
      `https://github.com/${repo}/tree/develop/.changes`,
    );
  });

  it('uses the full room: one more build would cross the cap', () => {
    const n = notes(400, 1);
    const max = 30_000;
    const body = capReleaseBody(head, n, repo, max);
    expect(body.length).toBeLessThanOrEqual(max);
    const kept = [...body.matchAll(/^## Build (\d+)$/gm)].length / 2;
    const oldest = 400 - kept; // the next build that was dropped
    const extra = `\n\n## Build ${oldest}\n\n### Neu\n- Neu entry ${oldest} ${'x'.repeat(400)}`;
    expect(body.length + 2 * extra.length).toBeGreaterThan(max);
  });
});
