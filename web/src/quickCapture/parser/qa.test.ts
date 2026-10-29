import { describe, expect, it } from 'vitest';
import { parseCapture } from './index';

// Thursday, 2026-10-29, 10:00. Sentences from the QA round (docs/qa/CONSOLIDATED.md, B12/V17/V04).
const NOW = new Date(2026, 9, 29, 10, 0);
const parse = (text: string) => parseCapture(text, { now: NOW });

describe('weekday sets and intervals', () => {
  it.each([
    ['Mo–Fr Dienst', [1, 2, 3, 4, 5]],
    ['Mo-Fr Dienst', [1, 2, 3, 4, 5]],
    ['Montag bis Freitag Dienst', [1, 2, 3, 4, 5]],
    ['Mo und Mi Dienst', [1, 3]],
    ['Mo, Mi, Fr Dienst', [1, 3, 5]],
    ['montags und mittwochs Dienst', [1, 3]],
    ['jeden Montag und Mittwoch Dienst', [1, 3]],
    ['Fr–Mo Dienst', [5, 6, 7, 1]],
  ])('%s', (text, days) => {
    expect(parse(text).fields.recurrence).toEqual({ freq: 'weekly', interval: 1, byWeekday: days });
  });

  it('keeps plain words and lone abbreviations out of the rule', () => {
    for (const text of ['so ein Mist', 'so und so', 'do it later', 'Freitag Dienst']) {
      expect(parse(text).fields.recurrence, text).toBeUndefined();
    }
  });

  it('reads number words in "alle zwei Wochen"', () => {
    expect(parse('alle zwei Wochen Putzen').fields.recurrence).toEqual({
      freq: 'weekly',
      interval: 2,
    });
  });

  it('starts a weekday set on the earliest matching day, skipping today when its time has passed', () => {
    expect(parse('Mo-Fr Frühdienst 6 Uhr').fields.date).toBe('2026-10-30');
    expect(parse('Mo-Fr Spätdienst 22 Uhr').fields.date).toBe('2026-10-29');
  });
});

describe('end time, end date, priority', () => {
  it.each([
    ['Workshop 14:00 bis 16:00', '14:00', '16:00'],
    ['Workshop 14:00-16:00', '14:00', '16:00'],
    ['Workshop von 10 bis 12 Uhr', '10:00', '12:00'],
    ['Workshop 10–12 Uhr', '10:00', '12:00'],
    ['Nachtdienst 21:30 bis 06:30', '21:30', '06:30'],
  ])('%s', (text, time, end) => {
    const r = parse(text);
    expect(r.fields.time).toBe(time);
    expect(r.fields.endTime).toBe(end);
  });

  it('does not read counts or dates as a time range', () => {
    for (const text of ['3 bis 5 Äpfel kaufen', '1-2 Tage Urlaub', 'am 10.-12.11. Messe']) {
      expect(parse(text).fields.endTime, text).toBeUndefined();
    }
  });

  it('puts "bis <date>" next to a rule into the rule, not into the start date', () => {
    const r = parse('jeden Montag Sport bis 31.12.');
    expect(r.fields.recurrence?.until).toBe('2026-12-31');
    expect(r.fields.date).toBe('2026-11-02');
  });

  it('reads the priority only as "!word"', () => {
    expect(parse('Angebot schicken !hoch').fields.priority).toBe(3);
    expect(parse('Angebot schicken !niedrig').fields.priority).toBe(1);
    expect(parse('Angebot hoch schicken').fields.priority).toBeUndefined();
  });
});

describe('types', () => {
  it('a deadline verb makes a ToDo even with a clock time', () => {
    expect(parse('Hausarbeit freitag 12 Uhr abgeben').type).toBe('todo');
    expect(parse('Zahnarzt freitag 12 Uhr').type).toBe('event');
  });

  it('an amount next to "bis" or "fällig" is an invoice, a plain one stays an expense', () => {
    expect(parse('Strom 54,30 Euro bis Freitag').type).toBe('invoice');
    expect(parse('Rechnung Hosting 49,90 fällig 5.11.').fields.title).toBe('Hosting');
    expect(parse('Kaffee 3,50 €').type).toBe('finance');
    expect(parse('Kaffee 3,80 Ausgabe').fields.title).toBe('Kaffee');
  });

  it('an amount with a monthly or yearly rule is a subscription', () => {
    const r = parse('Netflix 12,99 monatlich');
    expect(r.type).toBe('subscription');
    expect(r.fields.amountMinor).toBe(1299);
    expect(parse('Miete 700 € monatlich').type).toBe('subscription');
    expect(parse('jeden Tag 9 Euro sparen').type).not.toBe('subscription');
  });

  it('a birthday needs a date', () => {
    expect(parse('Geburtstag Anna 14.11.').type).toBe('birthday');
    expect(parse('Geburtstag Anna planen').type).not.toBe('birthday');
  });

  it('"nächsten Freitag" is the Friday of next week', () => {
    expect(parse('bis nächsten Freitag Formular').fields.date).toBe('2026-11-06');
    expect(parse('bis Freitag Formular').fields.date).toBe('2026-10-30');
  });
});
