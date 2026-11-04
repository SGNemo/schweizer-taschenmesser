import { describe, expect, it } from 'vitest';
import type { ChangeEntry } from './changes';
import {
  groupEntries,
  insertSection,
  renderSection,
  upsertVersion,
  type VersionData,
} from './changelogRelease';

const e = (p: Partial<ChangeEntry>): ChangeEntry => ({
  type: 'added',
  area: 'calendar',
  breaking: false,
  highlight: false,
  de: 'Deutsch',
  en: 'English',
  ...p,
});
const v: VersionData = {
  version: '1.1.0',
  date: '2026-11-10',
  entries: [
    e({ type: 'fixed', area: 'todos', en: 'Fixed todo', de: 'Todo behoben' }),
    e({ en: 'Cal feature', de: 'Kalender-Neuheit' }),
    e({ area: 'ai', highlight: true, en: 'Big AI', de: 'Große KI' }),
    e({ type: 'changed', area: 'sync', breaking: true, en: 'Sync format', de: 'Sync-Format' }),
    e({ type: 'security', area: 'app', en: 'Safer', de: 'Sicherer' }),
  ],
};

describe('groupEntries', () => {
  it('orders breaking, highlights, then types, each entry once', () => {
    const g = groupEntries(v.entries);
    expect(g.map((x) => x.key)).toEqual(['breaking', 'highlights', 'added', 'fixed', 'security']);
    expect(g.flatMap((x) => x.entries)).toHaveLength(5);
  });
});

describe('renderSection', () => {
  it('writes the English section with area prefixes, sorted by area', () => {
    const md = renderSection(v, 'en');
    expect(md.startsWith('## [1.1.0] – 2026-11-10')).toBe(true);
    expect(md.indexOf('### Breaking changes')).toBeLessThan(md.indexOf('### Highlights'));
    expect(md.indexOf('### Highlights')).toBeLessThan(md.indexOf('### Added'));
    expect(md).toContain('- **AI:** Big AI');
    expect(md).toContain('- **Sync:** Sync format');
    expect(md).not.toContain('Deutsch');
  });
  it('writes the German section', () => {
    const md = renderSection(v, 'de');
    expect(md).toContain('### Wichtig vor dem Update');
    expect(md).toContain('- **Kalender:** Kalender-Neuheit');
    expect(md).toContain('### Behoben');
  });
});

describe('insertSection', () => {
  const base = '# Changelog\n\nintro\n\n## Unreleased\n\n## [1.0.0] – 2026-10-07\n\n- old\n';
  it('puts the new section on top, drops Unreleased, keeps older ones', () => {
    const out = insertSection(base, renderSection(v, 'en'), '1.1.0');
    expect(out.indexOf('## [1.1.0]')).toBeLessThan(out.indexOf('## [1.0.0]'));
    expect(out).not.toContain('Unreleased');
    expect(out).toContain('- old');
  });
  it('replaces a section of the same version instead of duplicating it', () => {
    const once = insertSection(base, renderSection(v, 'en'), '1.1.0');
    const twice = insertSection(once, renderSection(v, 'en'), '1.1.0');
    expect(twice.match(/## \[1\.1\.0\]/g)).toHaveLength(1);
    expect(twice).toBe(once);
  });
});

describe('upsertVersion', () => {
  it('adds the newest first, replaces a repeat and collects the used areas', () => {
    const a = upsertVersion({ areas: {}, versions: [] }, { ...v, version: '1.0.0' });
    const b = upsertVersion(a, v);
    const c = upsertVersion(b, { ...v, entries: [e({ area: 'maps' })] });
    expect(c.versions.map((x) => x.version)).toEqual(['1.1.0', '1.0.0']);
    expect(Object.keys(c.areas)).toEqual(expect.arrayContaining(['maps', 'calendar']));
    expect(c.areas.maps).toEqual({ de: 'Karten', en: 'Maps' });
  });
});

describe('extractSection', () => {
  it('returns one version section, or an empty string', async () => {
    const { extractSection } = await import('./changelogRelease');
    const md =
      '# Changelog\n\n## [1.1.0] – 2026-11-10\n\n### Added\n- **A:** x\n\n## [1.0.0] – d\n\n- old\n';
    expect(extractSection(md, '1.1.0')).toBe('## [1.1.0] – 2026-11-10\n\n### Added\n- **A:** x');
    expect(extractSection(md, '9.9.9')).toBe('');
  });
});
