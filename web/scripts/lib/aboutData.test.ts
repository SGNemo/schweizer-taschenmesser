import { describe, expect, it } from 'vitest';
import { extractChangelogSection } from './aboutData';

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
