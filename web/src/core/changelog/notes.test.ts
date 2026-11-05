import { describe, expect, it } from 'vitest';
import { parseReleaseNotes } from './notes';

const RELEASE = [
  '## [1.2.0] – 2026-11-10',
  '',
  '### Wichtig vor dem Update',
  '- **App:** Die Datenbank wird umgestellt.',
  '',
  '### Highlights',
  '- **KI:** Große KI.',
  '',
  '### Neu',
  '- **Kalender:** Feiertage.',
  '',
  '---',
  '',
  '## [1.2.0] – 2026-11-10',
  '',
  '### Highlights',
  '- **AI:** Big AI.',
  '',
  '### Added',
  '- **Calendar:** Holidays.',
].join('\n');

describe('parseReleaseNotes', () => {
  it('reads version, date and blocks of the German part first', () => {
    const n = parseReleaseNotes(RELEASE, 'de');
    expect(n).toMatchObject({ version: '1.2.0', date: '2026-11-10' });
    expect(n.blocks.map((b) => b.heading)).toEqual(['Wichtig vor dem Update', 'Highlights', 'Neu']);
    expect(n.blocks[0]?.warning).toBe(true);
    expect(n.blocks[1]?.items[0]).toEqual({ lead: 'KI:', text: 'Große KI.' });
  });
  it('every other language reads the English part', () => {
    for (const lang of ['en', 'es', 'fr', 'pt-BR']) {
      const n = parseReleaseNotes(RELEASE, lang);
      expect(n.blocks.map((b) => b.heading)).toEqual(['Highlights', 'Added']);
    }
  });
  it('drops the Dev-Preview preamble and marks unreleased notes', () => {
    const md =
      '> Dev-Preview 1.0.0-dev.5 – untested\n> Not a release.\n\n## Unreleased\n\n### Highlights\n- **Kalender:** Neu.\n\n---\n\n## Unreleased\n\n### Highlights\n- **Calendar:** New.';
    const de = parseReleaseNotes(md, 'de');
    expect(de.unreleased).toBe(true);
    expect(de.blocks).toHaveLength(1);
    expect(de.blocks[0]?.items[0]?.text).toBe('Neu.');
    expect(JSON.stringify(parseReleaseNotes(md, 'en'))).not.toContain('Dev-Preview');
  });
  it('reads commit-style notes of old releases (one language, links and code stripped)', () => {
    const md = [
      '## 1.2.0 (2026-10-01)',
      '### Features',
      '- **ai:** add Groq ([`abc1234`](https://github.com/o/r/commit/abc))',
      '- plain item',
      '**Full changelog:** https://github.com/o/r/compare/a...b',
    ].join('\n');
    const n = parseReleaseNotes(md, 'de');
    expect(n).toMatchObject({ version: '1.2.0', date: '2026-10-01' });
    expect(n.blocks).toEqual([
      {
        heading: 'Features',
        items: [{ lead: 'ai:', text: 'add Groq (abc1234)' }, { text: 'plain item' }],
      },
    ]);
  });
  it('keeps HTML inert (plain text only) and handles empty notes', () => {
    expect(
      parseReleaseNotes('- <img src=x onerror=alert(1)>', 'en').blocks[0]?.items[0]?.text,
    ).toBe('<img src=x onerror=alert(1)>');
    expect(parseReleaseNotes('', 'de').blocks).toEqual([]);
    expect(parseReleaseNotes('\n\n', 'en').blocks).toEqual([]);
  });
  it('pre-release version strings keep their suffix', () => {
    expect(parseReleaseNotes('## [1.3.0-beta.2] – 2026-11-01\n- x', 'en').version).toBe(
      '1.3.0-beta.2',
    );
  });
  it('reads a Dev-Preview text with one section per build, newest first, and the unreleased rest', () => {
    const md = [
      '> Dev-Preview 1.0.0-dev.686 – untested',
      '',
      '## Build 686',
      '### Neu',
      '- **Kalender:** Eins.',
      '',
      '## Build 685',
      '### Behoben',
      '- **Todos:** Zwei.',
      '',
      '## Unreleased',
      '### Neu',
      '- **App:** Drei.',
      '',
      '---',
      '',
      '## Build 686',
      '### Added',
      '- **Calendar:** One.',
    ].join('\n');
    const de = parseReleaseNotes(md, 'de');
    expect(de.sections.map((x) => [x.build, x.unreleased ?? false])).toEqual([
      [686, false],
      [685, false],
      [undefined, true],
    ]);
    expect(de.sections[1]?.blocks[0]?.items[0]).toEqual({ lead: 'Todos:', text: 'Zwei.' });
    const en = parseReleaseNotes(md, 'en');
    expect(en.sections).toHaveLength(1);
    expect(en.sections[0]?.blocks[0]?.items[0]?.text).toBe('One.');
  });
  it('keeps a build heading without notes as an empty section', () => {
    const n = parseReleaseNotes(
      '## Build 730\n\n## Build 727\n### Neu\n- **App:** Eins.\n\n## Build 723',
      'de',
    );
    expect(n.sections.map((x) => [x.build, x.blocks.length])).toEqual([
      [730, 0],
      [727, 1],
      [723, 0],
    ]);
    expect(n.blocks).toHaveLength(1); // the flattened blocks are only the ones with notes
  });
});
