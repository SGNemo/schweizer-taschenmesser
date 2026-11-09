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
  estimateMin?: number;
  /** Plan captures (`p` / „plan:“): pin, earliest day, hard due. */
  pin?: string;
  startDate?: string;
  hardDue?: boolean;
  /** Run with Fitness on (`ParseOptions.fitness`): the meal and workout sentences. */
  fitness?: true;
  /** Run with the Uhr module on (`ParseOptions.place`, a stub that knows Tokio, New York and Lisbon). */
  place?: true;
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
  // Planner capture (package 2): prefix „p“ or „plan:“ – a plain day pins, „ab“ is the earliest day, a deadline word is hard.
  {
    from: 'plan',
    text: 'p Steuer 2 Std bis Do',
    type: 'plan',
    title: 'Steuer',
    estimateMin: 120,
    date: '2026-11-05',
    hardDue: true,
  },
  {
    from: 'plan',
    text: 'plan: Keller aufräumen ab Sa',
    type: 'plan',
    title: 'Keller aufräumen',
    startDate: '2026-10-31',
  },
  {
    from: 'plan',
    text: 'p Blogpost Freitag 90 min !wichtig',
    type: 'plan',
    title: 'Blogpost',
    pin: '2026-10-30',
    estimateMin: 90,
    priority: 3,
  },
  { from: 'plan', text: 'P Fahrrad', type: 'plan', title: 'Fahrrad' },
  {
    from: 'plan',
    text: 'Plan: Steuerbescheid prüfen Frist 3.11.',
    type: 'plan',
    title: 'Steuerbescheid prüfen',
    date: '2026-11-03',
    hardDue: true,
  },
  // Uhr: „uhr <Stadt>“ adds a place, parsed with the module on; anything that is no place stays a ToDo.
  { from: 'clock', place: true, text: 'uhr Tokio', type: 'place', title: 'Tokio' },
  { from: 'clock', place: true, text: 'Uhr: New York', type: 'place', title: 'New York' },
  { from: 'clock', place: true, text: 'clock lisbon', type: 'place', title: 'lisbon' },
  { from: 'clock', place: true, text: 'Uhr reparieren lassen', type: 'todo' },
  { from: 'clock', text: 'uhr Tokio', type: 'todo' },
  // Fitness (docs/features/fitness.md §5), parsed with Fitness on.
  { from: 'fitness', fitness: true, text: 'kcal 650 Döner', type: 'meal', title: 'Döner' },
  { from: 'fitness', fitness: true, text: 'Döner 650 kcal', type: 'meal', title: 'Döner' },
  {
    from: 'fitness',
    fitness: true,
    text: 'gestern kcal 400 Pizza',
    type: 'meal',
    title: 'Pizza',
    date: '2026-10-28',
  },
  {
    from: 'fitness',
    fitness: true,
    text: 'training Bankdrücken 3×8 60',
    type: 'workout',
    title: 'Bankdrücken',
  },
  {
    from: 'fitness',
    fitness: true,
    text: 'Training: Bankdrücken 3x8 60kg, Kniebeuge 3×5 80',
    type: 'workout',
    title: 'Bankdrücken, Kniebeuge',
  },
  {
    from: 'fitness',
    fitness: true,
    text: 'training Laufen 30 Min',
    type: 'workout',
    title: 'Laufen',
  },
  // … and these stay what they were.
  {
    from: 'fitness',
    fitness: true,
    text: 'Essen mit Anna Freitag 19 Uhr',
    type: 'event',
    date: '2026-10-30',
    time: '19:00',
  },
  {
    from: 'fitness',
    fitness: true,
    text: 'Training morgen 18 Uhr',
    type: 'event',
    date: '2026-10-30',
    time: '18:00',
  },
  // Use case „Kopf leer“ (docs/design/usecases/kopf-leer/TARGET.md §3): the five lines of a brain dump
  // (reminder words wait for package 2), the counter-scenarios, and past-tense spend words.
  { from: 'KL', text: 'Müll runterbringen', type: 'todo', title: 'Müll runterbringen' },
  { from: 'KL', text: 'Wohnzimmer aufräumen', type: 'todo', title: 'Wohnzimmer aufräumen' },
  {
    from: 'KL',
    text: 'Vermieter wegen Heizung antworten',
    type: 'todo',
    title: 'Vermieter wegen Heizung antworten',
  },
  {
    from: 'KL',
    text: 'Steuerbescheid prüfen bis Freitag',
    type: 'todo',
    date: '2026-10-30',
    title: 'Steuerbescheid prüfen',
  },
  {
    from: 'KL',
    text: 'Mittagessen 12,50 € ausgegeben',
    type: 'finance',
    amountMinor: 1250,
    kind: 'expense',
    title: 'Mittagessen',
  },
  {
    from: 'KL',
    text: 'Rechnung an Kunde Nord 500 € bis 30.10.',
    type: 'invoice',
    amountMinor: 50000,
    date: '2026-10-30',
  },
  {
    from: 'KL',
    text: 'Brot gekauft 3,80 €',
    type: 'finance',
    amountMinor: 380,
    kind: 'expense',
    title: 'Brot',
  },
  {
    from: 'KL',
    text: 'Tanken 62,40 bezahlt',
    type: 'finance',
    amountMinor: 6240,
    kind: 'expense',
    title: 'Tanken',
  },
  { from: 'KL', text: 'Miete bezahlt 850 €', type: 'finance', amountMinor: 85000, title: 'Miete' },
  // Without an amount a past-tense word is just text.
  { from: 'KL', text: 'Schuhe gekauft', type: 'todo', title: 'Schuhe gekauft' },
  // „Kopf leer“ package 2: payment reminder words are invoice words; „zahlen“ + amount points to an invoice.
  {
    from: 'KL2',
    text: 'Mahnung Stadtwerke 87,40 € zahlen',
    type: 'invoice',
    amountMinor: 8740,
    title: 'Stadtwerke',
  },
  { from: 'KL2', text: '2. Mahnung Telekom 45,90 €', type: 'invoice', title: 'Telekom' },
  { from: 'KL2', text: 'Zahlungserinnerung Zahnarzt 120 €', type: 'invoice', amountMinor: 12000 },
  { from: 'KL2', text: 'Stadtwerke 84,30 € zahlen', type: 'invoice', title: 'Stadtwerke' },
  // Without an amount a reminder word stays text: a ToDo to check it.
  {
    from: 'KL2',
    text: 'Mahnung Stadtwerke prüfen',
    type: 'todo',
    title: 'Mahnung Stadtwerke prüfen',
  },
];
