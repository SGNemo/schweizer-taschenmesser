import { describe, expect, it } from 'vitest';
import {
  pagesToMarkdown,
  pageToMarkdown,
  pageToText,
  parseImport,
  safeFileName,
} from '../exchange';

const page = (title: string, body: string, id = 'p') => ({ id, title, body });

describe('export', () => {
  it('writes the title as a heading unless the text starts with it', () => {
    expect(pageToMarkdown(page('Reise', 'Packen'))).toBe('# Reise\n\nPacken');
    expect(pageToMarkdown(page('Reise', '# Reise\n\nPacken'))).toBe('# Reise\n\nPacken');
    expect(pageToMarkdown(page('', 'Nur Text'))).toBe('Nur Text');
  });
  it('joins pages with a rule and names the scratch pad', () => {
    const md = pagesToMarkdown([page('A', 'a'), page('', 'x', 'scratch')], 'Schmierzettel');
    expect(md).toBe('# A\n\na\n\n---\n\n# Schmierzettel\n\nx\n');
  });
  it('writes plain text without Markdown syntax', () => {
    expect(pageToText(page('Liste', '- [x] **Brot**\n- Milch'))).toBe('Liste\n\nBrot\nMilch\n');
  });
  it('makes safe file names', () => {
    expect(safeFileName('a/b: c?*.')).toBe('a b c');
    expect(safeFileName('   ')).toBe('Notiz');
    expect(safeFileName('x'.repeat(200))).toHaveLength(80);
  });
});

describe('import', () => {
  it('takes the first folder as notebook, keeps line breaks of .txt, skips other files', () => {
    const { pages, skipped } = parseImport([
      { path: 'Reisen/Rom.md', text: '# Rom\n\nColosseum' },
      { path: 'Reisen/Packliste.txt', text: 'Socken\nZahnbürste' },
      { path: 'lose.md', text: 'Nur ein Satz' },
      { path: 'Reisen/foto.png', text: 'x' },
      { path: 'leer.md', text: '   ' },
    ]);
    expect(pages.map((p) => [p.folder, p.title])).toEqual([
      ['Reisen', 'Rom'],
      ['Reisen', 'Packliste'],
      [null, 'lose'],
    ]);
    expect(pages[1]!.body).toBe('Socken  \nZahnbürste');
    expect(skipped).toBe(2);
  });
});
