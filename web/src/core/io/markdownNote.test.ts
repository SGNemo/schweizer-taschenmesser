import { describe, expect, it } from 'vitest';
import { noteDates, parseMarkdownNote, parseMarkdownNotes, parseNoteDate } from './markdownNote';

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

describe('D17 (round 5): dates from the front matter', () => {
  const local = (y: number, m: number, d: number, h = 0, mi = 0) =>
    new Date(y, m - 1, d, h, mi).getTime();

  it('created:/date: → createdAt, modified:/updated: → updatedAt (first key wins)', () => {
    const note = parseMarkdownNote(
      '---\ncreated: 2025-12-01\nmodified: "2026-01-05 18:30"\ndate: 2020-01-01\n---\nText',
      'a.md',
    )!;
    expect(note.createdAt).toBe(local(2025, 12, 1));
    expect(note.updatedAt).toBe(local(2026, 1, 5, 18, 30));
    expect(
      parseMarkdownNote('---\ndate: 2024-03-04\nupdated: 2024-03-05\n---\nText'),
    ).toMatchObject({
      createdAt: local(2024, 3, 4),
      updatedAt: local(2024, 3, 5),
    });
  });

  it('reads a zone when given; impossible or foreign values are ignored', () => {
    expect(parseNoteDate('2025-12-01T09:30:00Z')).toBe(Date.UTC(2025, 11, 1, 9, 30));
    expect(parseNoteDate('2025-12-01Z')).toBe(Date.UTC(2025, 11, 1));
    expect(parseNoteDate('2025-12-01T10:30+01:00')).toBe(Date.UTC(2025, 11, 1, 9, 30));
    for (const bad of [
      '2025-02-31',
      '01.12.2025',
      'gestern',
      '',
      '2025-12-01 25:00',
      '2025-12-01 09:30:75',
    ])
      expect(parseNoteDate(bad), bad).toBeUndefined();
    const note = parseMarkdownNote('---\ncreated: bald\n---\nText')!;
    expect(note.createdAt).toBeUndefined();
  });

  it('a note without dates carries none', () => {
    expect(Object.keys(parseMarkdownNote('# T\nText')!)).not.toContain('createdAt');
  });

  it('noteDates: front matter first, the file date for whatever is missing', () => {
    expect(noteDates({}, 5)).toEqual({ createdAt: 5, updatedAt: 5 });
    expect(noteDates({ createdAt: 1 }, 5)).toEqual({ createdAt: 1, updatedAt: 5 });
    expect(noteDates({ createdAt: 1, updatedAt: 2 }, 5)).toEqual({ createdAt: 1, updatedAt: 2 });
    expect(noteDates({ createdAt: 1 })).toEqual({ createdAt: 1 });
    // Only modified: known and a younger copy date – created never after modified.
    expect(noteDates({ updatedAt: 3 }, 9)).toEqual({ createdAt: 3, updatedAt: 3 });
    expect(noteDates({ updatedAt: 3 })).toEqual({ createdAt: 3, updatedAt: 3 });
    expect(noteDates({})).toBeUndefined();
  });
});
