import { describe, expect, it } from 'vitest';
import { parseCapture, toCents, type CaptureResult } from './index';

// Wednesday, 2026-09-30, 10:00 local time. All examples below are invented.
const NOW = new Date(2026, 8, 30, 10, 0);
const parse = (text: string, defaultType?: 'todo' | 'event'): CaptureResult =>
  parseCapture(text, { now: NOW, defaultType });

describe('date and time', () => {
  const cases: [string, string | undefined, string | undefined, string][] = [
    ['morgen 15 Uhr Zahnarzt', '2026-10-01', '15:00', 'Zahnarzt'],
    ['Freitag 14 Uhr Teamtreffen', '2026-10-02', '14:00', 'Teamtreffen'],
    ['Zahnarzt am Freitag um 14:30', '2026-10-02', '14:30', 'Zahnarzt'],
    ['übermorgen um 9:30 Friseur', '2026-10-02', '09:30', 'Friseur'],
    ['am 3.10. Oma besuchen', '2026-10-03', undefined, 'Oma besuchen'],
    ['3.10.2026 14:00 Test', '2026-10-03', '14:00', 'Test'],
    ['am 3. Oktober 18 Uhr Kino', '2026-10-03', '18:00', 'Kino'],
    ['nächsten Montag Müll rausstellen', '2026-10-05', undefined, 'Müll rausstellen'],
    ['Mittwoch Bericht abgeben', '2026-10-07', undefined, 'Bericht abgeben'],
    ['in 2 Stunden Pizza holen', '2026-09-30', '12:00', 'Pizza holen'],
    ['in einer halben Stunde Anruf', '2026-09-30', '10:30', 'Anruf'],
    ['in 3 Tagen Paket abholen', '2026-10-03', undefined, 'Paket abholen'],
    ['in 2 Wochen Impftermin', '2026-10-14', undefined, 'Impftermin'],
    ['nächste Woche Bericht', '2026-10-05', undefined, 'Bericht'],
    ['Ende des Monats Miete prüfen', '2026-09-30', undefined, 'Miete prüfen'],
    ['heute Abend Kino', '2026-09-30', '18:00', 'Kino'],
    ['morgen früh Bäcker', '2026-10-01', '08:00', 'Bäcker'],
    ['halb 8 Frühstück morgen', '2026-10-01', '07:30', 'Frühstück'],
    ['2026-11-05 Steuer', '2026-11-05', undefined, 'Steuer'],
  ];
  it.each(cases)('%s', (text, date, time, title) => {
    const r = parse(text);
    expect(r.fields.date).toBe(date);
    expect(r.fields.time).toBe(time);
    expect(r.fields.title).toBe(title);
  });

  it('rolls a past day/month into next year and says so', () => {
    const r = parse('am 3.2. Geburtstag feiern');
    expect(r.fields.date).toBe('2027-02-03');
    expect(r.notes).toContain('rolled-year');
  });

  it('keeps an explicit past date but flags it', () => {
    const r = parse('1.9.2026 Rechnung');
    expect(r.fields.date).toBe('2026-09-01');
    expect(r.notes).toContain('past-date');
  });

  it('ignores impossible dates instead of guessing', () => {
    expect(parse('am 31.2. Test').fields.date).toBeUndefined();
  });

  it('never treats "Morgenroutine" as tomorrow', () => {
    expect(parse('Morgenroutine planen').fields.date).toBeUndefined();
  });

  it('flags ambiguous short hours', () => {
    const r = parse('morgen um 3 Zahnarzt');
    expect(r.fields.time).toBe('03:00');
    expect(r.notes).toContain('ambiguous-time');
  });
});

describe('recurrence', () => {
  it.each([
    ['jede Woche Wäsche', { freq: 'weekly', interval: 1 }],
    ['täglich Tabletten', { freq: 'daily', interval: 1 }],
    ['jeden Monat Zählerstand', { freq: 'monthly', interval: 1 }],
    ['alle 2 Wochen Putzen', { freq: 'weekly', interval: 2 }],
    ['jeden 1. Miete zahlen', { freq: 'monthly', interval: 1, byMonthDay: 1 }],
    ['jeden Montag Sport', { freq: 'weekly', interval: 1, byWeekday: [1] }],
    ['jedes Jahr Steuererklärung', { freq: 'yearly', interval: 1 }],
  ])('%s', (text, rec) => {
    expect(parse(text).fields.recurrence).toEqual(rec);
  });

  it('starts weekday rules on the next matching day and monthly rules on the next day-of-month', () => {
    expect(parse('jeden Montag Sport').fields.date).toBe('2026-10-05');
    expect(parse('jeden 1. Miete zahlen').fields.date).toBe('2026-10-01');
    expect(parse('jeden 30. Abrechnung').fields.date).toBe('2026-09-30');
  });

  it('does not read "jeden 1." as a date', () => {
    const r = parse('jeden 1. Miete zahlen');
    expect(r.fields.title).toBe('Miete zahlen');
    expect(r.type).toBe('reminder');
  });
});

describe('amounts', () => {
  it.each([
    ['Kaffee 3,50 €', 350, 'expense'],
    ['Kaffee 12 EUR', 1200, 'expense'],
    ['Bäcker € 5', 500, 'expense'],
    ['Tickets 1.234,56 €', 123456, 'expense'],
    ['Gehalt 2000 €', 200000, 'income'],
    ['+50 € Verkauf', 5000, 'income'],
  ])('%s', (text, cents, kind) => {
    const r = parse(text);
    expect(r.fields.amountMinor).toBe(cents);
    expect(r.fields.kind).toBe(kind);
    expect(r.type).toBe('finance');
  });

  it('needs a currency marker without the finance prefix', () => {
    const r = parse('3 Äpfel kaufen');
    expect(r.fields.amountMinor).toBeUndefined();
    expect(r.type).toBe('todo');
  });

  it('toCents rejects zero and garbage', () => {
    expect(toCents('0')).toBeUndefined();
    expect(toCents('12,5')).toBe(1250);
    expect(toCents('1.234')).toBe(123400);
  });
});

describe('type detection', () => {
  it('appointment: date + time', () => {
    const r = parse('morgen 15 Uhr Zahnarzt');
    expect(r.type).toBe('event');
    expect(r.needsChoice).toBe(false);
  });

  it('reminder keyword', () => {
    const r = parse('erinnere mich morgen an Müll rausbringen');
    expect(r.type).toBe('reminder');
    expect(r.fields.title).toBe('Müll rausbringen');
    expect(r.fields.date).toBe('2026-10-01');
  });

  it('reminder without a date is assumed for today and says so', () => {
    const r = parse('erinnere mich daran Milch zu kaufen');
    expect(r.type).toBe('reminder');
    expect(r.fields.date).toBe('2026-09-30');
    expect(r.notes).toContain('assumed-date');
  });

  it('todo keywords and plain text', () => {
    expect(parse('todo Steuer machen').type).toBe('todo');
    expect(parse('aufgabe: Keller aufräumen').fields.title).toBe('Keller aufräumen');
    const plain = parse('Blumen gießen');
    expect(plain.type).toBe('todo');
    expect(plain.needsChoice).toBe(false);
  });

  it('honours the default type for plain text', () => {
    expect(parse('Blumen gießen', 'event').type).toBe('event');
  });

  it('date without time is a ToDo with a due date and an all-day alternative', () => {
    const r = parse('am 3.10. Oma besuchen');
    expect(r.type).toBe('todo');
    expect(r.fields.date).toBe('2026-10-03');
    expect(r.alternatives.map((a) => a.type)).toContain('event');
  });

  it('time without date assumes today or tomorrow and flags it', () => {
    const later = parse('15 Uhr Zahnarzt');
    expect(later.fields.date).toBe('2026-09-30');
    expect(later.notes).toContain('assumed-date');
    expect(parse('9 Uhr Zahnarzt').fields.date).toBe('2026-10-01');
  });

  it('bookmarks: URL or "merke"', () => {
    const r = parse('https://example.org/artikel lesen');
    expect(r.type).toBe('bookmark');
    expect(r.fields.url).toBe('https://example.org/artikel');
    expect(parse('merke Buchtipp Der Prozess').type).toBe('bookmark');
    expect(parse('www.example.org').fields.url).toBe('https://www.example.org');
  });

  it('asks instead of guessing when signals compete', () => {
    const link = parse('https://example.org morgen 15 Uhr');
    expect(link.needsChoice).toBe(true);
    const money = parse('Zahnarzt morgen 15 Uhr 80 €');
    expect(money.needsChoice).toBe(true);
    expect(money.alternatives.map((a) => a.type)).toContain('finance');
  });

  it('recurrence with a time is a reminder, event stays an alternative', () => {
    const r = parse('jeden Montag 8 Uhr Wochenplanung');
    expect(r.type).toBe('reminder');
    expect(r.alternatives[0]?.type).toBe('event');
  });
});

describe('prefixes', () => {
  it('the keyword "Einkaufsliste" picks the list type', () => {
    expect(parse('Milch auf die Einkaufsliste').type).toBe('list');
  });

  it.each([
    ['t Steuer machen', 'todo', 'Steuer machen'],
    ['k morgen 15 Uhr Zahnarzt', 'event', 'Zahnarzt'],
    ['e Tabletten jeden Tag', 'reminder', 'Tabletten'],
    ['m https://example.org', 'bookmark', 'https://example.org'],
    ['l Milch', 'list', 'Milch'],
    ['$ 12,50 Mittagessen', 'finance', 'Mittagessen'],
    ['$12 Kaffee', 'finance', 'Kaffee'],
  ])('%s', (text, type, title) => {
    const r = parse(text);
    expect(r.type).toBe(type);
    expect(r.forced).toBe(true);
    expect(r.needsChoice).toBe(false);
    expect(r.confidence).toBe(1);
    expect(r.fields.title).toBe(title);
  });

  it('does not eat a normal first word that merely starts with a prefix letter', () => {
    expect(parse('Termin morgen').forced).toBe(false);
    expect(parse('tanken').fields.title).toBe('Tanken');
  });

  it('forced finance takes a bare number', () => {
    expect(parse('$ 12,50 Mittagessen').fields.amountMinor).toBe(1250);
  });
});

describe('robustness', () => {
  it('is deterministic and never throws', () => {
    for (const s of [
      '',
      '   ',
      '€',
      '$',
      't ',
      '!!!',
      '99999999999999999999 €',
      'am 0.0.',
      'um 99',
    ]) {
      const a = parse(s);
      expect(a).toEqual(parse(s));
      expect(typeof a.fields.title).toBe('string');
    }
  });
});

describe('effort estimate', () => {
  const cases: [string, number | undefined, string][] = [
    ['Formular ausfüllen 15 min', 15, 'Formular ausfüllen'],
    ['Mail beantworten 5min', 5, 'Mail beantworten'],
    ['Keller aufräumen 1 Std', 60, 'Keller aufräumen'],
    ['Bericht schreiben 1,5 h', 90, 'Bericht schreiben'],
    ['ca. 30 Minuten Wohnung saugen', 30, 'Wohnung saugen'],
    ['Aufgabe: Steuer 45min morgen', 45, 'Steuer'],
  ];
  it.each(cases)('%s', (text, minutes, title) => {
    const r = parse(`t ${text}`);
    expect(r.fields.estimateMin).toBe(minutes);
    expect(r.fields.title).toBe(title);
  });

  it('keeps relative times as times, not as an estimate', () => {
    const r = parse('in 45 Minuten Anruf');
    expect(r.fields.time).toBe('10:45');
    expect(r.fields.estimateMin).toBeUndefined();
  });

  it('ignores implausible values and non-todo texts', () => {
    expect(parse('t Sauna 0 min').fields.estimateMin).toBeUndefined();
    expect(parse('t Sauna 999 min').fields.estimateMin).toBeUndefined();
    const ev = parse('morgen 15 Uhr Zahnarzt 20 min');
    expect(ev.fields.estimateMin).toBeUndefined();
    expect(ev.fields.title).toContain('20 min');
  });
});
