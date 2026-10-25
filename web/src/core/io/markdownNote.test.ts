import { describe, expect, it } from 'vitest';
import { parseMarkdownNote, parseMarkdownNotes } from './markdownNote';

describe('parseMarkdownNote', () => {
  it('reads title and tags from Obsidian front matter', () => {
    const note = parseMarkdownNote(
      '---\ntitle: "Gartenplan: Frühling"\ntags:\n  - garten\n  - "#projekt"\naliases: [x]\n---\n\nBeete umgraben, [[Saatgut]] bestellen.\n',
      'ignored.md',
    );
    expect(note).toEqual({
      title: 'Gartenplan: Frühling',
      body: 'Beete umgraben, [[Saatgut]] bestellen.\n\n#garten #projekt',
      tags: ['garten', 'projekt'],
    });
  });

  it('accepts inline and comma tag forms', () => {
    expect(parseMarkdownNote('---\ntags: [a, b]\n---\nText')!.tags).toEqual(['a', 'b']);
    expect(parseMarkdownNote('---\ntags: eins, zwei\n---\nText')!.tags).toEqual(['eins', 'zwei']);
  });

  it('uses the first heading as title and drops it from the text', () => {
    const note = parseMarkdownNote('# Käsefondue für Vier\n\nBrot, Käse, Weißwein #rezept');
    expect(note?.title).toBe('Käsefondue für Vier');
    expect(note?.body).toBe('Brot, Käse, Weißwein #rezept');
    expect(note?.tags).toEqual(['rezept']);
  });

  it('keeps a later heading in the text and falls back to the file name', () => {
    const note = parseMarkdownNote('Intro\n\n## Abschnitt', 'Meine Notiz.md');
    expect(note?.title).toBe('Abschnitt');
    expect(note?.body).toBe('Intro\n\n## Abschnitt');
    expect(parseMarkdownNote('Nur Text', 'sub/Mein Plan.md')?.title).toBe('Mein Plan');
  });

  it('has no title for pasted text without a heading', () => {
    expect(parseMarkdownNote('Nur Text')).toEqual({ title: '', body: 'Nur Text', tags: [] });
  });

  it('finds #tags in the text but not in code, headings or numbers', () => {
    const note = parseMarkdownNote(
      '# Titel\n\nSiehe #Übung/Rücken und #todo.\n`#nope`\n```\n#codetag\n```\nPunkt #1, Farbe a#b, Link x.org/#anker',
    );
    expect(note?.tags).toEqual(['Übung/Rücken', 'todo']);
  });

  it('keeps wikilinks as text and handles CRLF and BOM', () => {
    const note = parseMarkdownNote('﻿# A\r\n\r\n[[Andere Notiz|Alias]]\r\n');
    expect(note?.body).toBe('[[Andere Notiz|Alias]]');
  });

  it('returns undefined for empty files and empty front matter', () => {
    expect(parseMarkdownNote('')).toBeUndefined();
    expect(parseMarkdownNote(' \n\n')).toBeUndefined();
    expect(parseMarkdownNote('---\ntitle: X\n---\n', 'x.md')).toBeUndefined();
  });

  it('keeps a note that starts with a horizontal rule whole', () => {
    const text = '---\nSome text here\n---\nMore text';
    expect(parseMarkdownNote(text, 'a.md')?.body).toBe(text);
  });
  it('ignores an unclosed front matter block', () => {
    expect(parseMarkdownNote('---\nHallo', 'a.md')?.body).toBe('---\nHallo');
  });
});

describe('parseMarkdownNotes', () => {
  it('reads several files and counts empty ones', () => {
    const r = parseMarkdownNotes([
      { name: 'a.md', text: 'Eins' },
      { name: 'leer.md', text: '' },
      { name: 'b.md', text: '# Zwei\ntext' },
    ]);
    expect(r.notes.map((n) => n.title)).toEqual(['a', 'Zwei']);
    expect(r.empty).toBe(1);
  });
});
