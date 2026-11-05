import { describe, expect, it } from 'vitest';
import { emphasize, graphemes, isBoldWeight, READ_START_TAG, READ_TEXT_TAG } from './readable';

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

describe('a word stays one piece', () => {
  const texts = [
    'Schmierzettel',
    'Notizzettel in Notizen',
    'Einkaufsliste für das Wochenende: Kartoffelsalat, Mineralwasser und Gartenerde.',
    'Donaudampfschifffahrtsgesellschaftskapitän anrufen',
    'Internet-Telefon über https://example.org/pfad',
  ];

  it('every emphasised start is followed directly by the rest of its word (no space, no break point between)', () => {
    for (const text of texts) {
      const runs = emphasize(text, { share: 0.4 });
      runs.forEach((run, i) => {
        if (!run.strong) return;
        const rest = runs[i + 1];
        expect(rest?.rest, `${text}: rest after "${run.text}"`).toBe(true);
        expect(/\s/.test(run.text + rest!.text), `${text}: "${run.text}${rest!.text}"`).toBe(false);
        expect(
          /^\p{L}/u.test(rest!.text),
          `${text}: rest of "${run.text}" starts with a letter`,
        ).toBe(true);
      });
    }
  });

  it('long protected strings (URLs, codes) stay one plain run, so the host decides how they wrap', () => {
    const runs = emphasize(
      'Formular: https://www.beispiel-behoerde.example/formulare/antrag-2026.pdf',
      {
        share: 0.4,
      },
    );
    expect(
      runs.some((r) =>
        r.text.includes('https://www.beispiel-behoerde.example/formulare/antrag-2026.pdf'),
      ),
    ).toBe(true);
    expect(runs.filter((r) => r.strong).map((r) => r.text)).toEqual(['For']);
  });

  it('marks the aid with its own inline element names, never span (host span rules cannot reach them)', () => {
    // Valid autonomous custom element names: lower case, start with a letter, contain a hyphen.
    for (const tag of [READ_TEXT_TAG, READ_START_TAG]) {
      expect(tag).toMatch(/^[a-z][a-z0-9.-]*-[a-z0-9.-]*$/);
      expect(tag).not.toBe('span');
    }
    expect(READ_TEXT_TAG).not.toBe(READ_START_TAG);
  });
});

describe('isBoldWeight', () => {
  it('treats semibold and heavier as bold (the start then takes the heavy weight)', () => {
    expect(isBoldWeight('600')).toBe(true);
    expect(isBoldWeight('700')).toBe(true);
    expect(isBoldWeight('500')).toBe(false);
    expect(isBoldWeight('400')).toBe(false);
    expect(isBoldWeight('bold')).toBe(true);
    expect(isBoldWeight('normal')).toBe(false);
  });
});
