import { describe, expect, it } from 'vitest';
import { collectLicenses, extractChangelogSection } from './aboutData';

const MD = `# Changelog

intro

## Unreleased

### Neu
- Something new

## 0.3.1 (2026-10-01) – "Nemo 0.3.1"
Small update.

### Geändert
- Wordmark

## 0.3.0 (2026-09-30)
- old
`;

describe('extractChangelogSection', () => {
  it('returns the section of the version', () => {
    const s = extractChangelogSection(MD, '0.3.1');
    expect(s).toContain('Small update.');
    expect(s).toContain('- Wordmark');
    expect(s).not.toContain('old');
    expect(s).not.toContain('Something new');
  });
  it('falls back to Unreleased for an unknown version', () => {
    expect(extractChangelogSection(MD, '0.4.0')).toContain('Something new');
  });
  it('is empty without a match and caps long sections', () => {
    expect(extractChangelogSection('# Changelog', '1.0.0')).toBe('');
    const long = `## 1.0.0\n${Array.from({ length: 100 }, (_, i) => `- ${i}`).join('\n')}`;
    const s = extractChangelogSection(long, '1.0.0', 10);
    expect(s.split('\n')).toHaveLength(11);
    expect(s.endsWith('…')).toBe(true);
  });
});

describe('collectLicenses', () => {
  const packages: Record<string, object> = {
    b: { version: '2.0.0', license: 'ISC', repository: { url: 'git+https://github.com/x/b.git' } },
    a: { version: '1.0.0', license: 'MIT', homepage: 'https://a.example' },
    c: { version: '3.0.0', licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }] },
  };
  const read = (n: string) => packages[n];
  it('sorts by name and normalises repository links', () => {
    expect(collectLicenses(['b', 'a'], read)).toEqual([
      { name: 'a', version: '1.0.0', license: 'MIT', url: 'https://a.example' },
      { name: 'b', version: '2.0.0', license: 'ISC', url: 'https://github.com/x/b' },
    ]);
  });
  it('reads the legacy licenses array and rejects missing packages', () => {
    expect(collectLicenses(['c'], read)[0]?.license).toBe('MIT OR Apache-2.0');
    expect(() => collectLicenses(['zzz'], read)).toThrow(/not installed/);
  });
});
