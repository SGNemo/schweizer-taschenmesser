import { describe, expect, it } from 'vitest';
import { emphasize, graphemes } from './readable';

const strongOf = (text: string, share = 0.4, minLen?: number) =>
  emphasize(text, { share, minLen })
    .filter((s) => s.strong)
    .map((s) => s.text);
const joined = (text: string, share = 0.4) =>
  emphasize(text, { share })
    .map((s) => s.text)
    .join('');

describe('emphasize', () => {
  it('never changes the visible text', () => {
    for (const t of [
      'Urlaubsplanung für den Sommer – 3 Wochen, 1.234,56 € (bezahlt)!',
      '  doppelte   Leerzeichen\nund Zeilen ',
      '',
      'Über Äpfel & Öl: Größe ändern',
    ])
      expect(joined(t)).toBe(t);
  });

  it('emphasises the start of each word by the share', () => {
    expect(strongOf('Wortanfang', 0.3)).toEqual(['Wor']);
    expect(strongOf('Wortanfang', 0.5)).toEqual(['Worta']);
  });

  it('keeps short words plain and honours the minimum length', () => {
    expect(strongOf('Ich gehe in die Stadt')).toEqual(['ge', 'St']);
    expect(strongOf('Ich gehe in die Stadt', 0.4, 5)).toEqual(['St']);
  });

  it('skips numbers, amounts, dates, times, codes, URLs and e-mails', () => {
    const t =
      '1.234,56 € 2026-10-05 10:30 SW-2026-1000 https://example.org/pfad mail@example.org v1.2.3';
    expect(strongOf(t)).toEqual([]);
  });

  it('skips ALL-CAPS abbreviations but not capitalised words', () => {
    expect(strongOf('KFZ Versicherung')).toEqual(['Versi']);
  });

  it('handles umlauts and never cuts inside a grapheme', () => {
    expect(strongOf('Überfällig')).toEqual(['Über']);
    const decomposed = 'Überfällig'; // Ü and ä as base + combining mark
    const [head] = strongOf(decomposed);
    expect(head).toBe('Über');
    expect(graphemes(decomposed)).toHaveLength(10);
  });

  it('treats hyphenated compounds word by word and caps very long starts', () => {
    expect(strongOf('Internet-Telefon')).toEqual(['Int', 'Tel']);
    expect(strongOf('Donaudampfschifffahrtsgesellschaft', 0.5)).toEqual(['Donaud']);
  });

  it('is memoised: the same input returns the same array', () => {
    const a = emphasize('Ein ausreichend langer Satz', { share: 0.4 });
    expect(emphasize('Ein ausreichend langer Satz', { share: 0.4 })).toBe(a);
  });

  it('survives truncation: any prefix of the runs still reads as the original prefix', () => {
    const text = 'Steuererklärung vorbereiten und Unterlagen sammeln';
    const runs = emphasize(text, { share: 0.4 });
    const all = runs.map((r) => r.text).join('');
    expect(text.startsWith(all.slice(0, 20))).toBe(true);
    expect(runs.length).toBeLessThan(text.split(' ').length * 3 + 1);
  });
});
