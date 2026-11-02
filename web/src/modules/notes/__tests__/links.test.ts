// @vitest-environment jsdom
import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { noteExtensions } from '../editor/extensions';
import { backlinks, extractLinks, findPage, suggestTitles } from '../links';

const page = (id: string, title: string, body = '') => ({ id, title, body });

describe('[[links]] in Markdown', () => {
  it('survive the editor round trip as exactly [[Title]] (no escaping)', () => {
    const md = 'Siehe [[Seite A]] und [[Über uns]] im Text.';
    const e = new Editor({ extensions: noteExtensions(), content: md, contentType: 'markdown' });
    expect(e.getMarkdown().trim()).toBe(md);
    expect(e.getText()).toContain('[[Seite A]]');
    e.destroy();
  });
  it('keep ordinary brackets as text', () => {
    const e = new Editor({
      extensions: noteExtensions(),
      content: 'a [x] b',
      contentType: 'markdown',
    });
    expect(e.getMarkdown()).not.toContain('[[');
    e.destroy();
  });
});

describe('link logic', () => {
  it('extracts targets once, in order, ignoring case and accents', () => {
    expect(extractLinks('[[A]] x [[b]] y [[a]] [[ Über ]] [[uber]]')).toEqual(['A', 'b', 'Über']);
    expect(extractLinks('[[]] [[a|b]] [ [x] ]')).toEqual([]);
  });
  it('finds a page by title, ignoring case and accents; the scratch pad is no target', () => {
    const pages = [
      page('scratch', 'Garten'),
      page('1', 'Garten'),
      page('2', '', 'Übersicht\nText'),
    ];
    expect(findPage('garten', pages)?.id).toBe('1');
    expect(findPage('UBERSICHT', pages)?.id).toBe('2');
    expect(findPage('nichts', pages)).toBeUndefined();
  });
  it('lists the pages that link to a page', () => {
    const target = page('t', 'Rezepte');
    const pages = [
      target,
      page('a', 'Wochenplan', 'Heute [[rezepte]]'),
      page('b', 'Einkauf', 'ohne Link'),
      page('c', 'Alpha', 'siehe [[Rezepte]] und [[Rezepte]]'),
      page('d', 'Selbst', '[[Selbst]]'),
    ];
    expect(backlinks(target, pages).map((p) => p.id)).toEqual(['c', 'a']);
    expect(backlinks(pages[4]!, pages)).toEqual([]);
  });
  it('suggests matching titles, prefix matches first', () => {
    const pages = [
      page('1', 'Reise'),
      page('2', 'Wochenplan Reise'),
      page('3', 'Garten'),
      page('s', 'scratch'),
    ];
    expect(suggestTitles('rei', pages)).toEqual(['Reise', 'Wochenplan Reise']);
    expect(suggestTitles('', pages, 2)).toHaveLength(2);
  });
});
