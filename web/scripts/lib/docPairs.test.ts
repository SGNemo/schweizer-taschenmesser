import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareDocs, docShape, englishTwin } from './docPairs';

const root = resolve(__dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('doc pairs', () => {
  it('folds German twins onto their English file name', () => {
    expect(englishTwin('docs/user/sync.de.md')).toBe('docs/user/sync.md');
    expect(englishTwin('README.de.md')).toBe('README.md');
    expect(englishTwin('docs/user/sync.md')).toBe('docs/user/sync.md');
  });

  it('reads headings, details, links and images but ignores code blocks', () => {
    const shape = docShape(
      [
        '<h1 align="center">Nemo</h1>',
        '## One',
        '```bash',
        '# not a heading',
        '```',
        '<details><summary>x</summary></details>',
        '[a](docs/a.de.md#part) [b](https://example.com) <a href="https://x.org">x</a>',
        '![pic](docs/p.png) <img src="docs/q.de.png">',
      ].join('\n'),
    );
    expect(shape.headings).toEqual([1, 2]);
    expect(shape.details).toBe(1);
    expect(shape.external).toEqual(['https://example.com', 'https://x.org']);
    expect(shape.relative).toEqual(['docs/a.md']);
    expect(shape.images).toEqual(['docs/p.png', 'docs/q.png']);
  });

  it('reports a heading, a details block or a link that only one language has', () => {
    const en = '# T\n## A\n<details></details>\n[x](https://a.org) [d](b.md)';
    expect(
      compareDocs(en, '# T\n## A\n<details></details>\n[x](https://a.org) [d](b.de.md)'),
    ).toEqual([]);
    const diffs = compareDocs(en, '# T\n[y](https://b.org)');
    expect(diffs.some((d) => d.startsWith('headings differ'))).toBe(true);
    expect(diffs.some((d) => d.startsWith('<details>'))).toBe(true);
    expect(diffs).toContain('external links only in English: https://a.org');
    expect(diffs).toContain('external links only in German: https://b.org');
    expect(diffs).toContain('relative links only in English: b.md');
  });

  it.each([
    ['README.md', 'README.de.md'],
    ['docs/AI-IMPORT.md', 'docs/AI-IMPORT.de.md'],
    ['docs/user/installation.md', 'docs/user/installation.de.md'],
  ])('%s and %s are in step', (en, de) => {
    expect(compareDocs(read(en), read(de))).toEqual([]);
  });
});
