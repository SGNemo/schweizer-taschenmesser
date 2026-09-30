import { describe, expect, it } from 'vitest';
import { convertCase, countText, lorem, sortLines, tidy } from './logic';

describe('countText', () => {
  it('is all zeros for an empty text', () => {
    expect(countText('')).toEqual({
      chars: 0,
      charsNoSpaces: 0,
      words: 0,
      lines: 0,
      sentences: 0,
      paragraphs: 0,
      minutes: 0,
    });
  });
  it('counts characters, words, lines, sentences and paragraphs', () => {
    const s = countText('Hallo Welt. Wie geht es dir?\n\nGut!');
    expect(s.words).toBe(7);
    expect(s.sentences).toBe(3);
    expect(s.paragraphs).toBe(2);
    expect(s.lines).toBe(3);
    expect(s.chars).toBe(34);
    expect(s.charsNoSpaces).toBe(27);
    expect(s.minutes).toBe(1);
  });
  it('counts emoji and umlauts as one character each and ignores pure punctuation as words', () => {
    expect(countText('Äpfel 🍎').chars).toBe(7);
    expect(countText('Äpfel 🍎').words).toBe(1);
    expect(countText('— – …').words).toBe(0);
  });
  it('counts a text without a final full stop as a sentence', () => {
    expect(countText('Erster Satz. Zweiter ohne Punkt').sentences).toBe(2);
  });
  it('rounds the reading time up in whole minutes', () => {
    expect(countText('wort '.repeat(201)).minutes).toBe(2);
  });
});

describe('convertCase', () => {
  it('handles German letters', () => {
    expect(convertCase('Straße äöü', 'upper')).toBe('STRASSE ÄÖÜ');
    expect(convertCase('ÄRGER', 'lower')).toBe('ärger');
  });
  it('capitalises every word for titles, also after hyphens and quotes', () => {
    expect(convertCase('der GROßE bär-aus „köln“', 'title')).toBe('Der Große Bär-Aus „Köln“');
  });
  it('capitalises sentence starts and lines', () => {
    expect(convertCase('ES REGNET. ABER wir gehen! ja\nnoch eine zeile', 'sentence')).toBe(
      'Es regnet. Aber wir gehen! Ja\nNoch eine zeile',
    );
  });
});

describe('tidy and sortLines', () => {
  const text = '  a   b  \n\n\tc\t\n';
  it('applies only the chosen clean-ups', () => {
    expect(tidy(text, { trimLines: true, collapseSpaces: false, dropEmptyLines: false })).toBe(
      'a   b\n\nc\n',
    );
    expect(tidy(text, { trimLines: true, collapseSpaces: true, dropEmptyLines: true })).toBe(
      'a b\nc',
    );
    expect(tidy(text, { trimLines: false, collapseSpaces: false, dropEmptyLines: false })).toBe(
      '  a   b  \n\n\tc\t\n',
    );
  });
  it('sorts lines the German way, both directions', () => {
    expect(sortLines('zebra\nÄpfel\nBirne', false)).toBe('Äpfel\nBirne\nzebra');
    expect(sortLines('b\na\nc', true)).toBe('c\nb\na');
  });
});

describe('lorem', () => {
  it('gives the requested number of paragraphs, clamped to 1–20, deterministic', () => {
    expect(lorem(3).split('\n\n')).toHaveLength(3);
    expect(lorem(0).split('\n\n')).toHaveLength(1);
    expect(lorem(99).split('\n\n')).toHaveLength(20);
    expect(lorem(2)).toBe(lorem(2));
    expect(lorem(1).startsWith('Lorem ipsum dolor sit amet')).toBe(true);
  });
});
