/**
 * "Erinner mich um 15 Uhr an die Wäsche": German reminder sentences, spoken or typed, must become a
 * calendar reminder (kind=reminder) with a fixed date, time and notification – computed by code from
 * `now()`, never by a model. Fixed clock: Tuesday 2026-09-29 10:00.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { visibleManifests } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { clearAll } from '../testing';
import { fold } from '../text';
import { prepareProposal } from './prepare';
import { detectIntent } from './rules/intent';
import { parseWrite } from './rules/parse';

const manifests = visibleManifests.filter((m) => m.id !== 'example');
const NOW = new Date(2026, 8, 29, 10, 0);
const TODAY = '2026-09-29';

interface Want {
  /** Folded title must equal this; undefined = the sentence has no title (preview asks for it). */
  title?: string;
  date: string;
  time: string;
  /** The time was not said: 09:00 is proposed and flagged. */
  defaulted?: boolean;
  freq?: string;
}

/** [input, expected]; the first block is absolute times, then relative ones, then phrasing. */
const CASES: [string, Want][] = [
  // absolute
  ['Erinner mich um 15 Uhr an die Wäsche', { title: 'Wäsche', date: TODAY, time: '15:00' }],
  [
    'Erinnere mich um 15:30 an den Anruf bei Oma',
    { title: 'Anruf bei Oma', date: TODAY, time: '15:30' },
  ],
  [
    'Erinnere mich um Viertel nach drei an die Wäsche',
    { title: 'Wäsche', date: TODAY, time: '15:15' },
  ],
  [
    'Erinnere mich um halb vier an die Tabletten',
    { title: 'Tabletten', date: TODAY, time: '15:30' },
  ],
  ['Erinnere mich um Viertel vor fünf an den Tee', { title: 'Tee', date: TODAY, time: '16:45' }],
  ['Erinnere mich um drei Uhr an den Müll', { title: 'Müll', date: TODAY, time: '15:00' }],
  ['Erinner mich um 8 Uhr 15 an die Tabletten', { title: 'Tabletten', date: TODAY, time: '20:15' }],
  ['Erinner mich um 18 Uhr ans Abendessen', { title: 'Abendessen', date: TODAY, time: '18:00' }],
  ['Erinnere mich heute um 16:45 an das Paket', { title: 'Paket', date: TODAY, time: '16:45' }],
  ['Erinner mich um 9 an die Kita', { title: 'Kita', date: TODAY, time: '21:00' }],
  [
    'Erinnerung am 12.10. um 14 Uhr Zahnarzt',
    { title: 'Zahnarzt', date: '2026-10-12', time: '14:00' },
  ],
  ['Erinner mich bitte um 15 Uhr an die Wäsche', { title: 'Wäsche', date: TODAY, time: '15:00' }],
  [
    'Kannst du mich um 15 Uhr an die Wäsche erinnern',
    { title: 'Wäsche', date: TODAY, time: '15:00' },
  ],
  ['Stell mir eine Erinnerung für 15 Uhr: Wäsche', { title: 'Wäsche', date: TODAY, time: '15:00' }],
  [
    'erinnere mich um viertel nach drei an die wäsche',
    { title: 'Wäsche', date: TODAY, time: '15:15' },
  ],
  // relative
  ['In 20 Minuten Pizza rausnehmen', { title: 'Pizza rausnehmen', date: TODAY, time: '10:20' }],
  ['Erinnere mich in 20 Minuten an die Pizza', { title: 'Pizza', date: TODAY, time: '10:20' }],
  ['in zwei Stunden Wäsche aufhängen', { title: 'Wäsche aufhängen', date: TODAY, time: '12:00' }],
  ['Erinner mich in einer Stunde an den Anruf', { title: 'Anruf', date: TODAY, time: '11:00' }],
  [
    'Erinner mich in einer halben Stunde ans Backblech',
    { title: 'Backblech', date: TODAY, time: '10:30' },
  ],
  ['Erinner mich in einer Viertelstunde an den Tee', { title: 'Tee', date: TODAY, time: '10:15' }],
  ['in 90 Minuten Ofen ausschalten', { title: 'Ofen ausschalten', date: TODAY, time: '11:30' }],
  ['erinner mich in zwanzig minuten an die pizza', { title: 'Pizza', date: TODAY, time: '10:20' }],
  [
    'Erinner mich in 2 Stunden dass ich die Wäsche aufhängen muss',
    { title: 'Wäsche aufhängen', date: TODAY, time: '12:00' },
  ],
  ['Erinner mich heute Abend an die Tabletten', { title: 'Tabletten', date: TODAY, time: '18:00' }],
  [
    'Erinner mich heute Nachmittag ans Telefonat',
    { title: 'Telefonat', date: TODAY, time: '15:00' },
  ],
  [
    'morgen früh um 8 an Zahnarzt anrufen',
    { title: 'Zahnarzt anrufen', date: '2026-09-30', time: '08:00' },
  ],
  [
    'Erinner mich morgen früh an den Zahnarzt',
    { title: 'Zahnarzt', date: '2026-09-30', time: '08:00' },
  ],
  ['Erinner mich morgen Mittag an die Post', { title: 'Post', date: '2026-09-30', time: '12:00' }],
  [
    'Erinner mich morgen um 8 Uhr an den Zahnarzt',
    { title: 'Zahnarzt', date: '2026-09-30', time: '08:00' },
  ],
  [
    'Montag um 9 Erinnerung Chef anrufen',
    { title: 'Chef anrufen', date: '2026-10-05', time: '09:00' },
  ],
  [
    'Erinner mich am Freitag um 17 Uhr an den Einkauf',
    { title: 'Einkauf', date: '2026-10-02', time: '17:00' },
  ],
  [
    'Erinnere mich übermorgen um 7 an den Flug',
    { title: 'Flug', date: '2026-10-01', time: '07:00' },
  ],
  // no time said → 09:00, flagged
  [
    'Erinnere mich übermorgen an den Geburtstag von Paula',
    { title: 'Geburtstag von Paula', date: '2026-10-01', time: '09:00', defaulted: true },
  ],
  [
    'Erinner mich in drei Tagen an den Müll',
    { title: 'Müll', date: '2026-10-02', time: '09:00', defaulted: true },
  ],
  [
    'Erinner mich nächsten Montag an die Steuer',
    { title: 'Steuer', date: '2026-10-05', time: '09:00', defaulted: true },
  ],
  [
    'Erinner mich morgen an die Tabletten',
    { title: 'Tabletten', date: '2026-09-30', time: '09:00', defaulted: true },
  ],
  // recurring, voice (lowercase), no title
  [
    'Erinner mich jeden Montag um 8 an die Biotonne',
    { title: 'Biotonne', date: '2026-10-05', time: '08:00', freq: 'weekly' },
  ],
  [
    'erinner mich morgen um 8 uhr an den zahnarzt',
    { title: 'Zahnarzt', date: '2026-09-30', time: '08:00' },
  ],
  ['Erinner mich in 20 Minuten', { date: TODAY, time: '10:20' }],
  ['Erinner mich um 15 Uhr', { date: TODAY, time: '15:00' }],
];

beforeAll(async () => {
  setNow(() => NOW.getTime());
  await clearAll();
  await db.table('_imports').clear();
});
afterAll(() => setNow());

describe('reminder sentences (rule stage)', () => {
  it('has at least 30 sentences', () => expect(CASES.length).toBeGreaterThanOrEqual(30));

  it.each(CASES)('%s', async (input, want) => {
    const proposal = await parseWrite(input, { manifests, database: db, now: NOW, today: TODAY });
    expect(proposal, 'rules must understand it').toBeDefined();
    expect(proposal!.ops).toHaveLength(1);
    const ctx = { manifests, known: manifests, database: db, today: TODAY };
    const [op] = await prepareProposal(proposal!.ops, ctx);
    expect(op!.module).toBe('calendar');
    expect(op!.data.kind).toBe('reminder');
    expect(op!.data.startDate).toBe(want.date);
    expect(op!.data.startTime).toBe(want.time);
    expect(op!.data.notify).toEqual({ minutesBefore: 0, enabled: true });
    if (want.title === undefined) {
      expect(op!.missing).toContain('title');
      expect(op!.ready).toBe(false);
    } else {
      expect(fold(String(op!.data.title))).toBe(fold(want.title));
      expect(op!.ready).toBe(true);
    }
    expect(op!.defaulted.includes('startTime')).toBe(want.defaulted === true);
    if (want.freq) expect((op!.data.recurrence as { freq: string }).freq).toBe(want.freq);
  });
});

describe('the bar offers "Eintragen" for every sentence of the table', () => {
  it.each(CASES.map(([input]) => input))('%s', (input) => {
    expect(detectIntent(input, manifests)).toBe('write');
  });

  it('questions and searches stay what they are', () => {
    for (const q of [
      'Was steht um 15 Uhr an?',
      'Zeige Erinnerungen morgen',
      'Wie viel kostet Netflix',
    ]) {
      expect(detectIntent(q, manifests), q).not.toBe('write');
    }
  });
});
