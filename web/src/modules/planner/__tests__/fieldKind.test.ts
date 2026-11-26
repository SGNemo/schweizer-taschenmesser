import { describe, expect, it } from 'vitest';
import { nameKey } from '@/quickCapture/targets/lookup';
import { fieldKind, type FieldKindContext } from '../fieldKind';

// Planner hub 2, package 3: the „sure when“ table of CONCEPT-INTAKE idea 3. Monday 30 Nov 2026, invented lines.
const ctx = (over: Partial<FieldKindContext> = {}): FieldKindContext => ({
  now: new Date(2026, 10, 30, 9, 0),
  today: '2026-11-30',
  until: '2026-12-13',
  on: () => true,
  known: new Set(['Milch', 'Spülmittel', 'Batterien AA'].map(nameKey)),
  ...over,
});
const kind = (line: string, over?: Partial<FieldKindContext>) => fieldKind(line, ctx(over))?.kind;

describe('fieldKind – the sure table', () => {
  it('Rechnung: the word and an amount', () => {
    expect(fieldKind('Rechnung Stadtwerke 80 € bis Fr', ctx())).toEqual({
      kind: 'invoice',
      fields: { title: 'Stadtwerke', amountMinor: 8000, date: '2026-12-04' },
      deadline: '2026-12-04',
    });
    expect(fieldKind('Rechnung Zahnarzt 120,50 €', ctx())).toEqual({
      kind: 'invoice',
      fields: { title: 'Zahnarzt', amountMinor: 12050 },
    });
    // Near misses: no amount, „Mahnung“ (it would double an open invoice), the plural word.
    expect(kind('Rechnung schreiben an Müller')).toBeUndefined();
    expect(kind('Mahnung Stadtwerke 80 €')).toBeUndefined();
    expect(kind('Rechnungen sortieren 2 Std')).toBeUndefined();
  });

  it('Einkauf: „kaufen“, „Einkauf:“, or a name the list or pantry knows', () => {
    expect(fieldKind('Einkauf: Milch, Brot, Eier', ctx())).toEqual({
      kind: 'list',
      names: ['Milch', 'Brot', 'Eier'],
    });
    expect(fieldKind('Batterien kaufen', ctx())).toEqual({ kind: 'list', names: ['Batterien'] });
    expect(fieldKind('milch', ctx())).toEqual({ kind: 'list', names: ['milch'] });
    expect(fieldKind('Batterien  AA', ctx())).toEqual({ kind: 'list', names: ['Batterien AA'] });
    // Near misses: a known name inside a longer line, an unknown name, „kaufen“ alone.
    expect(kind('Milch zum Nachbarn bringen')).toBeUndefined();
    expect(kind('Brot')).toBeUndefined();
    expect(kind('kaufen')).toBeUndefined();
  });

  it('Termin: a day and a clock time', () => {
    expect(fieldKind('Mi 15:00 Friseur', ctx())).toEqual({
      kind: 'event',
      fields: { title: 'Friseur', date: '2026-12-02', time: '15:00' },
    });
    expect(kind('Friseur 3.12. 9:30')).toBe('event');
    // Near misses: a time without a day, a day without a time, a rhythm.
    expect(kind('15:00 Friseur')).toBeUndefined();
    expect(kind('Friseur Mittwoch')).toBeUndefined();
    expect(kind('jeden Mi 15:00 Yoga')).toBeUndefined();
  });

  it('Notiz: starts with „Notiz:“ or „Idee:“', () => {
    expect(fieldKind('Idee: Regal im Flur', ctx())).toEqual({
      kind: 'note',
      title: 'Regal im Flur',
    });
    expect(kind('Notiz: Zählerstand 4711')).toBe('note');
    // Near misses: the word inside, no colon, nothing after it.
    expect(kind('Gute Idee: nachfragen')).not.toBe('note');
    expect(kind('Notiz schreiben')).toBeUndefined();
    expect(kind('Idee:')).toBeUndefined();
  });

  it('Link: the entry is one http/https address', () => {
    expect(fieldKind('https://example.org/fahrradtraeger', ctx())).toEqual({
      kind: 'bookmark',
      url: 'https://example.org/fahrradtraeger',
      host: 'example.org',
    });
    expect(kind('http://example.org')).toBe('bookmark');
    // Near misses: an address with words around it, no scheme, another scheme.
    expect(kind('lesen https://example.org')).toBeUndefined();
    expect(kind('www.example.org')).toBeUndefined();
    expect(kind('ftp://example.org/a')).toBeUndefined();
  });

  it('Aufgabe mit Schritten: „Name: a, b, c“ with at least two parts', () => {
    expect(fieldKind('Haushalt: Wäsche, Bad, Küche', ctx())).toEqual({
      kind: 'steps',
      title: 'Haushalt',
      steps: ['Wäsche', 'Bad', 'Küche'],
    });
    expect(kind('Steuer vorbereiten: Belege, Formular')).toBe('steps');
    // Near misses: one part, a clock time („15:00“ is no colon of a name), an address.
    expect(kind('Haushalt: Wäsche')).toBeUndefined();
    expect(kind('Treffen 15:00, Raum 2')).toBeUndefined();
    expect(kind('Siehe https://example.org, Seite 2')).toBeUndefined();
  });
});

describe('fieldKind – the order of readings', () => {
  it('a sure kind with a date wins over the planner reading; a date word alone stays the planner’s', () => {
    expect(kind('Rechnung Stadtwerke 80 € bis Fr')).toBe('invoice');
    expect(kind('Mi 15:00 Friseur')).toBe('event');
    expect(kind('Wäsche morgen')).toBeUndefined();
  });

  it('the planner’s own readings come first: „fest“, „Pause …“, „heute nur …“, a pasted plan, an instruction', () => {
    expect(kind('Mi 15:00 Friseur fest')).toBeUndefined();
    expect(kind('Rechnung Stadtwerke 80 € Fr!')).toBeUndefined();
    expect(kind('Pause 15:00 Kaffee: Küche, Balkon')).toBeUndefined();
    expect(kind('heute nur Milch')).toBeUndefined();
    expect(kind('Milch\nBrot')).toBeUndefined();
    expect(kind('Do frei')).toBeUndefined();
  });

  it('two kinds sure: the first of the order', () => {
    // An address inside an invoice line: the invoice, the address kept as its note.
    expect(fieldKind('Rechnung https://example.org 80 €', ctx())).toMatchObject({
      kind: 'invoice',
      fields: { amountMinor: 8000, note: 'https://example.org' },
    });
    // „Einkauf:“ is also „Name: a, b“: the list.
    expect(kind('Einkauf: Milch, Brot')).toBe('list');
    expect(kind('Idee: Regal, Lampe')).toBe('note');
  });

  it('a kind whose module is off is a ToDo, never the next kind', () => {
    const off = (id: string) => (m: string) => m !== id;
    expect(kind('Rechnung Stadtwerke 80 €', { on: off('invoices') })).toBeUndefined();
    expect(kind('Mi 15:00 Friseur', { on: off('calendar') })).toBeUndefined();
    expect(kind('Milch', { on: off('lists') })).toBeUndefined();
    expect(kind('Idee: Regal', { on: off('notes') })).toBeUndefined();
    expect(kind('https://example.org', { on: off('bookmarks') })).toBeUndefined();
    expect(kind('Einkauf: Milch, Brot', { on: off('lists') })).toBeUndefined();
  });

  it('an invoice due after the planned days and a past appointment get no line', () => {
    expect(kind('Rechnung Stadtwerke 80 € bis 20.12.')).toBeUndefined();
    expect(kind('Rechnung Stadtwerke 80 € bis 20.12.', { until: '2026-12-31' })).toBe('invoice');
    // A day already past rolls to next year: no sure day.
    expect(kind('23.11. 15:00 Friseur')).toBeUndefined();
  });
});
