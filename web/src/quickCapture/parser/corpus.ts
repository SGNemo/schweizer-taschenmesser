/**
 * Test corpus for the quick-capture parser: every sentence the QA round (docs/qa/CONSOLIDATED.md,
 * B12/V17) reported, plus a few that already worked so they stay working. Each case lists only the
 * parts it expects; `corpus.test.ts` counts a case as a hit when all of them match. Invented data.
 * Reference "now": Thursday, 2026-10-29, 10:00.
 */
import type { CaptureRecurrence, CaptureType } from './types';

export interface CorpusCase {
  /** Source finding, e.g. "J-B3" = Jonas, bug 3 (see docs/qa). */
  from: string;
  text: string;
  type?: CaptureType;
  date?: string;
  time?: string;
  endTime?: string;
  title?: string;
  recurrence?: CaptureRecurrence;
  amountMinor?: number;
  kind?: 'expense' | 'income';
  priority?: 1 | 2 | 3;
}

export const CORPUS_NOW = new Date(2026, 9, 29, 10, 0);

const MO_FR = [1, 2, 3, 4, 5];

export const CORPUS: CorpusCase[] = [
  // Reported: wrong type
  {
    from: 'J-B3',
    text: 'Statistik Hausarbeit freitag 12 Uhr abgeben',
    type: 'todo',
    date: '2026-10-30',
    time: '12:00',
    title: 'Statistik Hausarbeit abgeben',
  },
  {
    from: 'J-B2',
    text: 'Hausarbeit Statistik abgeben morgen 23:59 Uhr',
    type: 'todo',
    date: '2026-10-30',
    time: '23:59',
    title: 'Hausarbeit Statistik abgeben',
  },
  {
    from: 'M-F06',
    text: 'jeden Dienstag 16 Uhr Fußball Max',
    type: 'event',
    date: '2026-11-03',
    time: '16:00',
    title: 'Fußball Max',
    recurrence: { freq: 'weekly', interval: 1, byWeekday: [2] },
  },
  {
    from: 'M-F06',
    text: 'alle zwei Wochen Mittwoch Schwimmen',
    date: '2026-11-04',
    title: 'Schwimmen',
    recurrence: { freq: 'weekly', interval: 2, byWeekday: [3] },
  },
  {
    from: 'M-F06',
    text: 'Klassenfahrt Geld einsammeln bis nächsten Freitag',
    type: 'todo',
    date: '2026-11-06',
    title: 'Klassenfahrt Geld einsammeln',
  },
  { from: 'M-F06', text: 'Zahnarzt in 3 Tagen', date: '2026-11-01', title: 'Zahnarzt' },
  {
    from: 'P-B02',
    text: 'Rechnung Hosting 49,90 fällig 5.11.',
    type: 'invoice',
    date: '2026-11-05',
    amountMinor: 4990,
    title: 'Hosting',
  },
  {
    from: 'P-B02',
    text: 'Kaffee 3,80 Ausgabe',
    type: 'finance',
    amountMinor: 380,
    kind: 'expense',
    title: 'Kaffee',
  },
  {
    from: 'P-B02',
    text: 'Workshop Kunde Müller am 12.11. 14:00 bis 16:00',
    type: 'event',
    date: '2026-11-12',
    time: '14:00',
    endTime: '16:00',
    title: 'Workshop Kunde Müller',
  },
  {
    from: 'P-B02',
    text: 'Angebot an Kunde Schmidt schicken bis Freitag !hoch',
    type: 'todo',
    date: '2026-10-30',
    priority: 3,
    title: 'Angebot an Kunde Schmidt schicken',
  },
  {
    from: 'L-V-06',
    text: 'Strom 54,30 Euro bis Freitag',
    type: 'invoice',
    date: '2026-10-30',
    amountMinor: 5430,
    title: 'Strom',
  },
  {
    from: 'L-V-06',
    text: 'Netflix 12,99 monatlich',
    type: 'subscription',
    amountMinor: 1299,
    title: 'Netflix',
    recurrence: { freq: 'monthly', interval: 1 },
  },
  {
    from: 'L-V-06',
    text: 'Geburtstag Anna 14.11.',
    type: 'birthday',
    date: '2026-11-14',
    title: 'Anna',
  },
  // Reported: shifts and weekdays (V04)
  {
    from: 'L-V-02',
    text: 'Frühdienst morgen 6 bis 14:30',
    type: 'event',
    date: '2026-10-30',
    time: '06:00',
    endTime: '14:30',
    title: 'Frühdienst',
  },
  {
    from: 'L-V-09',
    text: 'alle 2 Wochen Mo–Fr Frühdienst 6 Uhr bis 31.12.',
    type: 'event',
    time: '06:00',
    title: 'Frühdienst',
    recurrence: { freq: 'weekly', interval: 2, byWeekday: MO_FR, until: '2026-12-31' },
  },
  {
    from: 'L-V-09',
    text: 'Frühdienst Mo-Fr 6 Uhr',
    type: 'event',
    time: '06:00',
    title: 'Frühdienst',
    recurrence: { freq: 'weekly', interval: 1, byWeekday: MO_FR },
  },
  {
    from: 'J-V',
    text: 'Statistik Vorlesung Mo und Mi 10 bis 12 Uhr',
    type: 'event',
    time: '10:00',
    endTime: '12:00',
    title: 'Statistik Vorlesung',
    recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 3] },
  },
  // Worked before: must keep working
  {
    from: 'M-F05',
    text: 'morgen 15 Uhr Zahnarzt Lena',
    type: 'event',
    date: '2026-10-30',
    time: '15:00',
    title: 'Zahnarzt Lena',
  },
  {
    from: 'L-B-09',
    text: 'Frühdienst morgen 6 Uhr',
    type: 'event',
    date: '2026-10-30',
    time: '06:00',
    title: 'Frühdienst',
  },
  {
    from: 'L-V',
    text: 'jeden Tag 8 Uhr Tabletten Mama',
    type: 'reminder',
    time: '08:00',
    title: 'Tabletten Mama',
    recurrence: { freq: 'daily', interval: 1 },
  },
  { from: 'own', text: 'Milch kaufen', type: 'todo', title: 'Milch kaufen' },
  {
    from: 'own',
    text: 'jeden Montag Sport',
    type: 'reminder',
    date: '2026-11-02',
    title: 'Sport',
    recurrence: { freq: 'weekly', interval: 1, byWeekday: [1] },
  },
];
