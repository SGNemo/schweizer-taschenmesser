/**
 * Erstkontakt-Runde, person C (docs/qa/round-5/c/FINDINGS.md): short sentences typed with one
 * thumb. Reference "now": Thursday, 2026-10-29, 10:00 (as the corpus).
 */
import { describe, expect, it } from 'vitest';
import { CORPUS_NOW } from './corpus';
import { parseCapture } from './index';

const parse = (text: string) => parseCapture(text, { now: CORPUS_NOW });

describe('C02: an amount with decimal comma at the start or end is an expense', () => {
  it.each([
    ['Tanken 62,40', 'Tanken', 6240],
    ['Ölfilter 12,99', 'Ölfilter', 1299],
    ['8,50 Mittagessen', 'Mittagessen', 850],
    ['Werkzeug 1.249,00', 'Werkzeug', 124900],
  ])('%s', (text, title, cents) => {
    const r = parse(text);
    expect(r.type).toBe('finance');
    expect(r.fields).toMatchObject({ title, amountMinor: cents, kind: 'expense' });
  });

  it.each(['Version 1,25 testen', 'Arbeitszeit 7,5', 'Reifen 4 Stück', 'Seite 12,50 lesen'])(
    'no amount guessed: %s',
    (text) => {
      const r = parse(text);
      expect(r.fields.amountMinor).toBeUndefined();
      expect(r.fields.title).toBe(text);
    },
  );
});

describe('C03: short weekday before a time („Do 14 Uhr“) or after „am“', () => {
  it.each([
    ['Zahnarzt Do 14 Uhr', 'Zahnarzt', '2026-11-05', '14:00'], // like „Donnerstag“: never today,
    ['Bremsen Golf Fr 8 Uhr', 'Bremsen Golf', '2026-10-30', '08:00'],
    ['Kunde anrufen Di. 14:30', 'Kunde anrufen', '2026-11-03', '14:30'],
    ['Werkstatt am Mo um 7 Uhr', 'Werkstatt', '2026-11-02', '07:00'],
  ])('%s', (text, title, date, time) => {
    const r = parse(text);
    expect(r.type).toBe('event');
    expect(r.fields).toMatchObject({ title, date, time });
  });

  it('„am Sa“ without a time is a day', () => {
    expect(parse('Reifen wechseln am Sa').fields).toMatchObject({
      title: 'Reifen wechseln',
      date: '2026-10-31',
    });
  });

  it.each(['So ein Mist', 'Fr. Müller anrufen', 'Mo und Lisa grüßen', 'Do it yourself Regal'])(
    'plain words stay in the title: %s',
    (text) => {
      const r = parse(text);
      expect(r.fields.date).toBeUndefined();
      expect(r.fields.title).toBe(text);
    },
  );
});

describe('C08: the field example is a sentence the parser really reads', () => {
  it('„Tanken 62,40, morgen 9 Uhr Kunde anrufen“ = one expense + one appointment', async () => {
    const { splitCapture } = await import('./split');
    const { t } = await import('@/strings');
    const example = /„(.+)“/.exec(t.quickCapture.placeholder)?.[1] ?? '';
    const parts = splitCapture(example);
    expect(parts).toHaveLength(2);
    const [spend, call] = parts.map(parse);
    expect(spend).toMatchObject({
      type: 'finance',
      fields: { title: 'Tanken', amountMinor: 6240 },
    });
    expect(call).toMatchObject({
      type: 'event',
      fields: { title: 'Kunde anrufen', date: '2026-10-30', time: '09:00' },
    });
  });
});
