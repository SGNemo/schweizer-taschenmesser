import { describe, expect, it } from 'vitest';
import { CORPUS } from './corpus';
import { splitCapture } from './split';

/** Input → expected entries. A single entry means: stays exactly one line, nothing split. */
const CASES: [string, string[]][] = [
  // One line stays one line
  ['Milch kaufen', ['Milch kaufen']],
  ['morgen 15 Uhr Zahnarzt', ['morgen 15 Uhr Zahnarzt']],
  ['  Oma anrufen  ', ['Oma anrufen']],
  ['Brot, Milch und Eier kaufen', ['Brot, Milch und Eier kaufen']],
  ['Anna, Ben und Carla einladen', ['Anna, Ben und Carla einladen']],
  ['Rechnung zahlen und Oma anrufen', ['Rechnung zahlen und Oma anrufen']],
  ['Termin mit Anna und Ben am Freitag', ['Termin mit Anna und Ben am Freitag']],
  ['Zahnarzt am Freitag, 9 Uhr', ['Zahnarzt am Freitag, 9 Uhr']],
  ['Arzt am 3. Oktober, 10 Uhr', ['Arzt am 3. Oktober, 10 Uhr']],
  ['Hallo, wie geht es dir', ['Hallo, wie geht es dir']],
  // Amounts with a comma
  ['Kaffee 3,80 Ausgabe', ['Kaffee 3,80 Ausgabe']],
  ['Strom 54,30 Euro bis Freitag', ['Strom 54,30 Euro bis Freitag']],
  ['Miete 1.234,56 € am 1.', ['Miete 1.234,56 € am 1.']],
  ['Rechnung Hosting 49,90 fällig 5.11.', ['Rechnung Hosting 49,90 fällig 5.11.']],
  ['Kino 12,50, Oma anrufen', ['Kino 12,50', 'Oma anrufen']],
  // A time with a comma
  ['Laufen um 9, 30 Min', ['Laufen um 9, 30 Min']],
  ['Pause um 9, 30 Minuten lang', ['Pause um 9, 30 Minuten lang']],
  // Time ranges, weekday lists, "bis" are no separators
  ['Yoga 9–10 Uhr', ['Yoga 9–10 Uhr']],
  ['Statistik Vorlesung Mo und Mi 10 bis 12 Uhr', ['Statistik Vorlesung Mo und Mi 10 bis 12 Uhr']],
  ['Sport Mo, Mi und Fr 18 Uhr', ['Sport Mo, Mi und Fr 18 Uhr']],
  ['Mo, Mi und Fr Schwimmen', ['Mo, Mi und Fr Schwimmen']],
  ['Montag, Mittwoch und Freitag Gitarre üben', ['Montag, Mittwoch und Freitag Gitarre üben']],
  ['Gießen jeden Montag bis 31.12.', ['Gießen jeden Montag bis 31.12.']],
  ['Steuer bis 31.12. abgeben', ['Steuer bis 31.12. abgeben']],
  ['Workshop am 12.11. 14:00 bis 16:00', ['Workshop am 12.11. 14:00 bis 16:00']],
  // Brackets, links, abbreviations
  ['Brot kaufen (Vollkorn, groß)', ['Brot kaufen (Vollkorn, groß)']],
  ['https://example.com/a,b merken', ['https://example.com/a,b merken']],
  ['Termin bei Dr. Müller morgen', ['Termin bei Dr. Müller morgen']],
  ['z. B. Brot holen', ['z. B. Brot holen']],
  // A sentence with "und" after a comma list
  [
    'Milch kaufen, morgen Oma anrufen und Freitag Zahnarzt 9 Uhr',
    ['Milch kaufen', 'morgen Oma anrufen', 'Freitag Zahnarzt 9 Uhr'],
  ],
  ['Milch kaufen, Brot holen', ['Milch kaufen', 'Brot holen']],
  ['Zahnarzt Freitag; Friseur Samstag', ['Zahnarzt Freitag', 'Friseur Samstag']],
  ['Milch und Brot kaufen, Oma anrufen', ['Milch und Brot kaufen', 'Oma anrufen']],
  // Sentence ends (dictation)
  ['Milch kaufen. Oma anrufen.', ['Milch kaufen', 'Oma anrufen']],
  ['Paket abholen! Morgen Zahnarzt 9 Uhr', ['Paket abholen', 'Morgen Zahnarzt 9 Uhr']],
  ['Wann kommt das Paket? Oma anrufen', ['Wann kommt das Paket', 'Oma anrufen']],
  // Three lines
  [
    'Milch kaufen\nmorgen Oma anrufen\nFreitag Zahnarzt 9 Uhr',
    ['Milch kaufen', 'morgen Oma anrufen', 'Freitag Zahnarzt 9 Uhr'],
  ],
  ['Milch\nBrot\nEier', ['Milch', 'Brot', 'Eier']],
  ['Steuer abgeben\r\nAuto waschen', ['Steuer abgeben', 'Auto waschen']],
  // Empty and short lines drop out
  ['Milch kaufen\n\n   \nOma anrufen', ['Milch kaufen', 'Oma anrufen']],
  ['ok\nMilch kaufen\nx', ['Milch kaufen']],
  ['', []],
  ['   \n  ', []],
  // List markers
  ['- Milch kaufen\n- Oma anrufen', ['Milch kaufen', 'Oma anrufen']],
  ['* Milch\n* Brot', ['Milch', 'Brot']],
  ['• Steuer abgeben\n• Auto waschen', ['Steuer abgeben', 'Auto waschen']],
  [
    '1. Milch kaufen\n2. Oma anrufen\n3) Zahnarzt Freitag',
    ['Milch kaufen', 'Oma anrufen', 'Zahnarzt Freitag'],
  ],
  ['3. Oktober Zahnarzt\n4. November Friseur', ['3. Oktober Zahnarzt', '4. November Friseur']],
  ['- 12,50 € Kino\n- Oma anrufen', ['12,50 € Kino', 'Oma anrufen']],
  // A single line keeps its marker: it is read exactly as before
  ['- Milch kaufen', ['- Milch kaufen']],
  // Lines and sentences together
  [
    'Milch kaufen, Brot holen\nFreitag Zahnarzt 9 Uhr',
    ['Milch kaufen', 'Brot holen', 'Freitag Zahnarzt 9 Uhr'],
  ],
  ['Sport Mo, Mi und Fr 18 Uhr\nOma anrufen', ['Sport Mo, Mi und Fr 18 Uhr', 'Oma anrufen']],
];

describe('splitCapture', () => {
  it('has at least 40 examples', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(40);
  });

  it.each(CASES)('%j', (input, expected) => {
    expect(splitCapture(input)).toEqual(expected);
  });

  it('keeps every sentence of the parser corpus as one entry (one line = same reading as before)', () => {
    for (const c of CORPUS) expect(splitCapture(c.text), c.text).toEqual([c.text.trim()]);
  });
});
