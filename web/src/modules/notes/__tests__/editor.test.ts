// @vitest-environment jsdom
import { Editor } from '@tiptap/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutosaver } from '../editor/autosave';
import { clearDraft, loadDraft, saveDraft } from '../editor/draft';
import { noteExtensions } from '../editor/extensions';
import { markdownToPlain, plainToMarkdown, wordCount } from '../editor/markdown';
import { migrations } from '../migrations';

const FULL = `# Titel

## Zwischentitel

### Kleiner

Normal **fett** *kursiv* ~~weg~~ ==hell== =={danger}wichtig== \`code\` [Link](https://example.org)

- a
- b
  - c

1. eins
2. zwei

- [ ] offen
- [x] fertig

> Zitat

\`\`\`ts
const a = 1;
\`\`\`

---

| A | B |
| --- | --- |
| 1 | 2 |

![Bild](nemo-img:abc)
`;

function roundtrip(md: string): string {
  const e = new Editor({ extensions: noteExtensions(), content: md, contentType: 'markdown' });
  const out = e.getMarkdown();
  e.destroy();
  return out;
}

describe('Markdown roundtrip', () => {
  it('keeps every format and settles after one pass', () => {
    const once = roundtrip(FULL);
    for (const needle of [
      '# Titel',
      '## Zwischentitel',
      '### Kleiner',
      '**fett**',
      '*kursiv*',
      '~~weg~~',
      '==hell==',
      '=={danger}wichtig==',
      '`code`',
      '[Link](https://example.org)',
      '- [ ] offen',
      '- [x] fertig',
      '> Zitat',
      '```ts\nconst a = 1;\n```',
      '---',
      '![Bild](nemo-img:abc)',
    ])
      expect(once).toContain(needle);
    expect(once).toMatch(/\| A\s+\| B\s+\|/);
    expect(once).toMatch(/\| 1\s+\| 2\s+\|/);
    expect(roundtrip(once)).toBe(once);
  });

  it('keeps nested lists and numbering', () => {
    const out = roundtrip('- a\n- b\n  - c\n\n1. eins\n2. zwei\n');
    expect(out).toContain('- a\n- b\n  - c');
    expect(out).toContain('1. eins\n2. zwei');
  });
});

describe('plain text → Markdown (migration)', () => {
  it('keeps single line breaks as hard breaks', () => {
    const md = plainToMarkdown('Milch\nBrot\n\nNeuer Absatz');
    expect(md).toBe('Milch  \nBrot\n\nNeuer Absatz');
    expect(roundtrip(md)).toContain('Milch');
    const e = new Editor({ extensions: noteExtensions(), content: md, contentType: 'markdown' });
    expect(e.getText({ blockSeparator: '|' })).toBe('Milch\nBrot|Neuer Absatz');
    e.destroy();
  });

  it('leaves Markdown blocks and code alone, and is idempotent', () => {
    const src = '# H\n- a\n- b\n```\nx\ny\n```\n| a | b |\n| - | - |\nzeile\nzwei';
    const md = plainToMarkdown(src);
    expect(md).toBe('# H\n- a\n- b\n```\nx\ny\n```\n| a | b |\n| - | - |\nzeile  \nzwei');
    expect(plainToMarkdown(md)).toBe(md);
  });

  it('the module migration rewrites bodies and skips unchanged ones', async () => {
    const seen: Record<string, unknown>[] = [];
    await migrations[2]!({
      moduleId: 'notes',
      async forEachRecord(_c, fn) {
        for (const r of [{ body: 'a\nb' }, { body: 'single' }, {}]) {
          const patch = fn(r as Record<string, unknown>);
          if (patch) seen.push(patch);
        }
      },
    });
    expect(seen).toEqual([{ body: 'a  \nb' }]);
  });
});

describe('plain views of Markdown', () => {
  it('strips syntax for cards and search', () => {
    expect(
      markdownToPlain('# Titel\n\n- [x] **fett** und [Link](http://a.b) =={info}hier=='),
    ).toContain('Titel');
    const plain = markdownToPlain('- [x] **fett** und [Link](http://a.b) =={info}hier== [[Seite]]');
    expect(plain.trim()).toBe('fett und Link hier Seite');
    expect(wordCount('# Eins zwei\n\ndrei')).toBe(3);
    expect(wordCount('')).toBe(0);
  });
});

describe('autosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('serialises once after the pause and never for superseded edits', async () => {
    const saved: string[] = [];
    const saver = createAutosaver<string>(async (v) => void saved.push(v), 600);
    const read = vi.fn(() => 'b');
    saver.schedule(() => 'a');
    saver.schedule(read);
    expect(saver.pending()).toBe(true);
    await vi.advanceTimersByTimeAsync(599);
    expect(saved).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    expect(saved).toEqual(['b']);
    expect(read).toHaveBeenCalledTimes(1);
    expect(saver.pending()).toBe(false);
  });

  it('flush saves immediately (blur, hide, unmount) and a failed write does not stop later ones', async () => {
    const saved: string[] = [];
    let fail = true;
    const saver = createAutosaver<string>(async (v) => {
      if (fail) throw new Error('disk');
      saved.push(v);
    });
    saver.schedule(() => 'x');
    await saver.flush();
    fail = false;
    saver.schedule(() => 'y');
    await saver.flush();
    expect(saved).toEqual(['y']);
  });
});

describe('crash draft', () => {
  beforeEach(() => localStorage.clear());

  it('stores, restores and clears a draft per page', () => {
    saveDraft('p1', { title: 'T', body: 'text', at: 5 });
    expect(loadDraft('p1')).toEqual({ title: 'T', body: 'text', at: 5 });
    expect(loadDraft('p2')).toBeUndefined();
    clearDraft('p1');
    expect(loadDraft('p1')).toBeUndefined();
  });

  it('ignores damaged data and unavailable storage', () => {
    localStorage.setItem('tm-notes-draft:bad', '{"title":1}');
    expect(loadDraft('bad')).toBeUndefined();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(() => saveDraft('x', { title: '', body: '', at: 1 })).not.toThrow();
    spy.mockRestore();
  });
});

describe('large page', () => {
  it('loads and serialises 100,000 characters quickly', () => {
    const para = 'Ein Absatz mit **fett** und etwas Text, der sich wiederholt. ';
    const md = Array.from(
      { length: 1600 },
      (_, i) => `${i % 40 === 0 ? '## Abschnitt\n\n' : ''}${para}\n`,
    ).join('\n');
    expect(md.length).toBeGreaterThan(100_000);
    const t0 = performance.now();
    const e = new Editor({ extensions: noteExtensions(), content: md, contentType: 'markdown' });
    const out = e.getMarkdown();
    const ms = performance.now() - t0;
    e.destroy();
    expect(out.length).toBeGreaterThan(100_000);
    expect(ms).toBeLessThan(5000);
  });
});
