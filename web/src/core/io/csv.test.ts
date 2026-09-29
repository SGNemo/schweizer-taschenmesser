import { describe, expect, it } from 'vitest';
import { csvTable, detectDelimiter, normalizeHeader, parseCsv, toCsv } from './csv';

describe('parseCsv', () => {
  it('reads quoted fields, doubled quotes and line breaks inside quotes', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n"two\nlines",z', { delimiter: ',' })).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['two\nlines', 'z'],
    ]);
  });

  it('drops a BOM and empty lines', () => {
    expect(parseCsv('﻿a;b\n\n1;2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('round-trips through toCsv with any delimiter', () => {
    const rows = [
      ['name', 'note'],
      ['a;b', 'plain'],
      ['q"uote', 'multi\nline'],
    ];
    for (const d of [',', ';', '\t'] as const) {
      expect(parseCsv(toCsv(rows, d), { delimiter: d })).toEqual(rows);
    }
  });
});

describe('detectDelimiter', () => {
  it('finds the German semicolon, a comma and a tab', () => {
    expect(detectDelimiter('Buchungstag;Betrag;Text\n1;2;3')).toBe(';');
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
  });

  it('ignores delimiters inside quotes and defaults to a comma', () => {
    expect(detectDelimiter('"a;b;c",d,e\n')).toBe(',');
    expect(detectDelimiter('single')).toBe(',');
    expect(detectDelimiter('')).toBe(',');
  });

  it('parses German bank-style exports without configuration', () => {
    const rows = parseCsv('Betrag;Text\n"-12,50";"Kaffee; Kuchen"');
    expect(rows[1]).toEqual(['-12,50', 'Kaffee; Kuchen']);
  });
});

describe('csvTable', () => {
  it('keys records by normalized headers and pads short rows', () => {
    const t = csvTable(
      'Buchungstag;Verwendungszweck;Betrag (€)\n01.10.26;Miete;-700,00\n02.10.26;Strom',
    );
    expect(t.header).toEqual(['Buchungstag', 'Verwendungszweck', 'Betrag (€)']);
    expect(t.records[0]).toEqual({
      buchungstag: '01.10.26',
      verwendungszweck: 'Miete',
      betrag: '-700,00',
    });
    expect(t.records[1]!.betrag).toBe('');
  });

  it('is empty for empty input', () => {
    expect(csvTable('')).toEqual({ header: [], records: [] });
  });
});

describe('normalizeHeader', () => {
  it('ignores case, spacing, umlauts and punctuation', () => {
    expect(normalizeHeader(' Begünstigter/Zahlungspflichtiger ')).toBe(
      'beguenstigter zahlungspflichtiger'.replace('ue', 'u'),
    );
    expect(normalizeHeader('Straße')).toBe('strasse');
  });
});
