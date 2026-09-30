import { describe, expect, it } from 'vitest';
import { intentSchema } from '../query/schema';
import { contentWordCount, parseIntent } from './parser';

const TODAY = '2026-09-29';
const parse = (q: string) => parseIntent(q, { today: TODAY });
const intentOf = (q: string) => {
  const r = parse(q);
  if (r.kind !== 'intent')
    throw new Error(`no intent for "${q}" (unknown: ${r.unknown.join(',')})`);
  return r.intent;
};

describe('stage 1 parser: agenda', () => {
  it.each([
    ['heute', { relative: 'today' }],
    ['Was steht heute an?', { relative: 'today' }],
    ['was steht morgen an', { relative: 'tomorrow' }],
    ['was steht diese woche an', { relative: 'this_week' }],
    ['Was steht nächste Woche an?', { relative: 'next_week' }],
    ['was steht nächsten Monat an', { relative: 'next_month' }],
    ['gestern', { relative: 'yesterday' }],
    ['übermorgen', { from: '2026-10-01', to: '2026-10-01' }],
    ['heute und morgen', { from: '2026-09-29', to: '2026-09-30' }],
  ] as [string, Record<string, string>][])('%s', (q, agenda) => {
    expect(intentOf(q)).toEqual({ type: 'agenda', agenda });
  });

  it('understands "nächste 7 Tage"', () => {
    expect(intentOf('was steht in den nächsten 7 Tagen an')).toEqual({
      type: 'agenda',
      agenda: { relative: 'next_7_days' },
    });
  });

  it('module + time → agenda restricted to that module', () => {
    expect(intentOf('Welche Termine habe ich morgen?')).toEqual({
      type: 'agenda',
      agenda: { sources: ['calendar'], relative: 'tomorrow' },
    });
    expect(intentOf('Rechnungen diese Woche')).toEqual({
      type: 'agenda',
      agenda: { sources: ['invoices'], relative: 'this_week' },
    });
    expect(intentOf('Aufgaben heute')).toEqual({
      type: 'agenda',
      agenda: { sources: ['todos'], relative: 'today' },
    });
    expect(intentOf('Termine und Aufgaben morgen')).toEqual({
      type: 'agenda',
      agenda: { sources: ['calendar', 'todos'], relative: 'tomorrow' },
    });
  });
});

describe('stage 1 parser: lists', () => {
  it('open invoices', () => {
    for (const q of [
      'offene Rechnungen',
      'Rechnungen',
      'Welche Rechnungen sind offen?',
      'zeige mir meine offenen Rechnungen',
    ]) {
      expect(intentOf(q)).toMatchObject({
        type: 'query',
        query: {
          module: 'invoices',
          collection: 'invoice',
          filters: [{ field: 'status', op: 'eq', value: 'open' }],
          sort: { field: 'dueDate', dir: 'asc' },
        },
      });
    }
  });

  it('paid and overdue invoices', () => {
    expect(intentOf('bezahlte Rechnungen')).toMatchObject({
      query: { filters: [{ value: 'paid' }], sort: { field: 'paidAt', dir: 'desc' } },
    });
    expect(intentOf('überfällige Rechnungen')).toMatchObject({
      query: {
        module: 'invoices',
        filters: [{ field: 'status', value: 'open' }],
        range: { field: 'dueDate', relative: 'overdue' },
      },
    });
    expect(intentOf('bezahlte Rechnungen diesen Monat')).toMatchObject({
      query: { range: { field: 'paidAt', relative: 'this_month' } },
    });
  });

  it('subscriptions, todos, reminders, events', () => {
    expect(intentOf('Abos')).toMatchObject({
      query: { module: 'subscriptions', filters: [{ field: 'active', value: true }] },
    });
    expect(intentOf('meine ToDos')).toMatchObject({
      query: { module: 'todos', collection: 'task', filters: [{ field: 'done', value: false }] },
    });
    expect(intentOf('to do')).toMatchObject({ query: { module: 'todos' } });
    expect(intentOf('erledigte Aufgaben')).toMatchObject({
      query: { filters: [{ field: 'done', value: true }] },
    });
    expect(intentOf('überfällige Aufgaben')).toMatchObject({
      query: { module: 'todos', range: { relative: 'overdue' } },
    });
    expect(intentOf('Erinnerungen')).toMatchObject({ query: { module: 'reminders' } });
    expect(intentOf('Termine')).toEqual({
      type: 'agenda',
      agenda: { sources: ['calendar'], relative: 'next_7_days' },
    });
  });

  it('counts', () => {
    expect(intentOf('Wie viele Rechnungen sind offen?')).toMatchObject({
      query: { module: 'invoices', aggregate: 'count' },
    });
    expect(intentOf('wie viele aufgaben')).toMatchObject({
      query: { module: 'todos', aggregate: 'count' },
    });
  });

  it('finance bookings', () => {
    expect(intentOf('Buchungen')).toMatchObject({
      query: { module: 'finance', collection: 'transaction', sort: { field: 'date', dir: 'desc' } },
    });
    expect(intentOf('Ausgaben diesen Monat')).toMatchObject({
      query: {
        filters: [{ field: 'kind', value: 'expense' }],
        range: { field: 'date', relative: 'this_month' },
      },
    });
    expect(intentOf('Wie viel habe ich diesen Monat ausgegeben?')).toMatchObject({
      query: {
        filters: [{ field: 'kind', value: 'expense' }],
        aggregate: 'sum:amountMinor',
        range: { relative: 'this_month' },
      },
    });
  });
});

describe('stage 1 parser: computed views', () => {
  it.each([
    ['Kontostand', 'finance', 'balance'],
    ['wie viel Geld habe ich?', 'finance', 'balance'],
    ['Was ist verfügbar?', 'finance', 'balance'],
    ['Was kosten meine Abos?', 'subscriptions', 'costs'],
    ['Abo Kosten', 'subscriptions', 'costs'],
    ['Wie viel muss ich noch bezahlen?', 'invoices', 'open'],
    ['Summe offene Rechnungen', 'invoices', 'open'],
    ['wie viel Rechnungen', 'invoices', 'open'],
  ])('%s', (q, module, name) => {
    expect(intentOf(q)).toEqual({ type: 'computed', module, name });
  });
});

describe('stage 1 parser: search and unknown', () => {
  it('explicit search keeps the original text', () => {
    expect(intentOf('suche Zahnarzt Sonnenschein')).toEqual({
      type: 'fulltext',
      text: 'Zahnarzt Sonnenschein',
    });
    expect(intentOf('Finde Müller-Meier')).toEqual({ type: 'fulltext', text: 'Müller-Meier' });
  });

  it('leaves everything it does not fully understand alone', () => {
    for (const q of [
      'Was kostet Netflix?',
      'Erinnere mich jeden 1. an Miete',
      'Rechnungen von Vodafone',
      'Wie hoch waren meine Ausgaben für Lebensmittel?',
      'asdf',
      '',
      'Termine am Montag',
    ]) {
      expect(parse(q).kind, q).toBe('none');
    }
  });

  it('reports unknown words', () => {
    expect(parse('Rechnungen von Vodafone')).toEqual({ kind: 'none', unknown: ['vodafone'] });
  });

  it('counts content words', () => {
    expect(contentWordCount('was ist mit der Miete')).toBe(1); // everything but "Miete" is filler
    expect(contentWordCount('Miete Vodafone')).toBe(2);
    expect(contentWordCount('Miete')).toBe(1);
    expect(contentWordCount('Wann muss ich das Auto zum TÜV bringen')).toBeGreaterThanOrEqual(3);
  });

  it('only ever produces valid intents', () => {
    for (const q of [
      'heute',
      'offene Rechnungen',
      'Abos',
      'Kontostand',
      'suche x',
      'überfällige Aufgaben',
    ]) {
      expect(intentSchema.safeParse(intentOf(q)).success, q).toBe(true);
    }
  });
});
