// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MailAccountRef } from '@/core/mail/types';

let accounts: MailAccountRef[] = [];
vi.mock('@/core/mail/accounts', () => ({ listMailAccounts: async () => accounts }));
import { db } from '@/core/db/db';
import type { MailThreadSummary } from '@/core/mail/types';
import { setSettings } from '@/core/settings/settings';
import { setNow } from '@/core/time/now';
import { saveThreads, type CachedThreadView } from '../cache';
import { kindFilterOf, kindOf, type MailKind } from '../kinds';
import {
  isWaiting,
  mailQueueSummary,
  markDone,
  markLater,
  QUEUE_ROUTE,
  readMarks,
  unmark,
  waitingThreads,
  type QueueMarks,
} from '../queue';

const DAY = 86_400_000;
const NOW = new Date('2026-11-23T10:00:00').getTime();

const view = (id: string, extra: Partial<CachedThreadView> = {}): CachedThreadView => ({
  id,
  messageCount: 1,
  from: { name: 'Anna Beispiel', email: 'anna@example.org' },
  subject: 'Kurze Frage',
  snippet: 'Hast du Zeit?',
  date: NOW - DAY,
  unread: true,
  labelIds: ['INBOX', 'UNREAD'],
  hasAttachment: false,
  personal: true,
  demo: false,
  ...extra,
});

const NO_MARKS: QueueMarks = { done: {}, later: {} };
const ctx = (extra: Partial<Parameters<typeof isWaiting>[1]> = {}) => ({
  rule: 'reply' as const,
  marks: NO_MARKS,
  accountKey: 'google',
  me: 'me@example.org',
  at: NOW,
  ...extra,
});

beforeEach(async () => {
  setNow(() => NOW);
  localStorage.clear();
  accounts = [
    { key: 'google', connectorId: 'google', email: 'me@example.org', features: ['mail'] },
  ];
  await db.table('mail_thread').clear();
  await db.table('mail_body').clear();
  await db.table('_settings').clear();
});
afterEach(() => setNow(undefined));

describe('kinds (local rules, no model)', () => {
  const cases: [string, Partial<MailThreadSummary>, MailKind][] = [
    ['a bill from a utility', { subject: 'Ihre Rechnung Strom', personal: false }, 'invoice'],
    ['a payment reminder', { subject: 'Zahlungserinnerung Kundennummer 4711' }, 'invoice'],
    ['a debit note', { snippet: 'Der Betrag wird per Lastschrift eingezogen.' }, 'invoice'],
    ['a lawyer’s fee note', { subject: 'Kostennote 2026-17' }, 'invoice'],
    ['English invoice', { subject: 'Your invoice #123' }, 'invoice'],
    [
      'a promotion that says „Rechnung“',
      { subject: 'Auf Rechnung kaufen!', labelIds: ['CATEGORY_PROMOTIONS'] },
      'newsletter',
    ],
    [
      'a social network',
      { subject: 'Neue Nachricht', labelIds: ['INBOX', 'CATEGORY_SOCIAL'] },
      'newsletter',
    ],
    ['a list mail (not a person)', { subject: 'Rezepte der Woche', personal: false }, 'newsletter'],
    ['a friend', { subject: 'Wochenende?', personal: true }, 'other'],
    ['an office letter', { subject: 'Terminbestätigung', personal: true }, 'other'],
    ['unknown sender kind (old cache)', { subject: 'Hallo', personal: undefined }, 'other'],
    [
      'Gmail „Updates“ tab with a bill',
      { subject: 'Rechnung', labelIds: ['CATEGORY_UPDATES'] },
      'invoice',
    ],
  ];
  it.each(cases)('%s', (_name, th, want) => {
    expect(kindOf({ subject: '', snippet: '', labelIds: ['INBOX'], ...th })).toBe(want);
  });

  it('the address filter takes only the known words', () => {
    expect(kindFilterOf('invoice')).toBe('invoice');
    expect(kindFilterOf('newsletter')).toBe('newsletter');
    expect(kindFilterOf('other')).toBeUndefined();
    expect(kindFilterOf('<script>')).toBeUndefined();
    expect(kindFilterOf(null)).toBeUndefined();
  });
});

describe('„Wartet auf mich“: the rule', () => {
  const cases: [string, Partial<CachedThreadView>, boolean][] = [
    ['a question from a person, yesterday', {}, true],
    ['my own reply is the newest', { lastFromMe: true }, false],
    ['the newest message is from me (address)', { from: { email: 'ME@example.org' } }, false],
    ['a newsletter', { personal: false }, false],
    ['an invoice', { subject: 'Ihre Rechnung' }, false],
    ['archived (not in the inbox)', { labelIds: ['UNREAD'] }, false],
    ['31 days old', { date: NOW - 31 * DAY }, false],
    ['read but unanswered still waits', { unread: false, labelIds: ['INBOX'] }, true],
  ];
  it.each(cases)('%s', (_name, th, want) => {
    expect(isWaiting(view('t', th), ctx())).toBe(want);
  });

  it('„Mit Stern“ takes starred mail only; „Aus“ takes none', () => {
    expect(isWaiting(view('a', { labelIds: ['STARRED'] }), ctx({ rule: 'starred' }))).toBe(true);
    expect(isWaiting(view('b'), ctx({ rule: 'starred' }))).toBe(false);
    expect(isWaiting(view('c'), ctx({ rule: 'off' }))).toBe(false);
  });

  it('„Erledigt“ holds until a newer message; „Morgen wieder“ until tomorrow 06:00; undo brings it back', () => {
    const th = view('t');
    markDone('google', 't');
    expect(isWaiting(th, ctx({ marks: readMarks() }))).toBe(false);
    expect(
      isWaiting({ ...th, date: NOW + 1000 }, ctx({ marks: readMarks(), at: NOW + 2000 })),
    ).toBe(true);
    unmark('google', 't');
    expect(isWaiting(th, ctx({ marks: readMarks() }))).toBe(true);

    markLater('google', 't');
    const later = readMarks();
    expect(isWaiting(th, ctx({ marks: later }))).toBe(false);
    const tomorrow6 = new Date('2026-11-24T06:00:00').getTime();
    expect(isWaiting(th, ctx({ marks: later, at: tomorrow6 + 1 }))).toBe(true);
    // marks of another account do not count
    expect(isWaiting(th, ctx({ marks: later, accountKey: 'google#a1' }))).toBe(true);
  });

  it('marks hold thread ids and times only, and old ones are dropped', () => {
    markDone('google', 't1');
    const raw = localStorage.getItem('tm-mail-queue')!;
    expect(JSON.parse(raw)).toEqual({ done: { 'google|t1': NOW }, later: {} });
    setNow(() => NOW + 61 * DAY);
    markDone('google', 't2');
    expect(Object.keys(readMarks().done)).toEqual(['google|t2']);
  });

  it('a broken store reads as no marks', () => {
    localStorage.setItem('tm-mail-queue', '{"done":{"x":"soon"},"later":7}');
    expect(readMarks()).toEqual({ done: {}, later: {} });
    localStorage.setItem('tm-mail-queue', 'not json');
    expect(readMarks()).toEqual({ done: {}, later: {} });
  });

  it('lists newest first', () => {
    const list = waitingThreads(
      [view('old', { date: NOW - 5 * DAY }), view('new'), view('nl', { personal: false })],
      ctx(),
    );
    expect(list.map((th) => th.id)).toEqual(['new', 'old']);
  });
});

describe('the planner’s contract: a count and a route, nothing else', () => {
  const header = (id: string, extra: Partial<MailThreadSummary> = {}): MailThreadSummary => ({
    id,
    messageCount: 1,
    from: { name: 'Geheim Absender', email: 'secret@example.org' },
    subject: 'Geheimer Betreff',
    snippet: 'Geheime Vorschau?',
    date: NOW - DAY,
    unread: true,
    labelIds: ['INBOX', 'UNREAD'],
    hasAttachment: false,
    personal: true,
    ...extra,
  });

  it('counts the queue from the device cache, without network, and names no mail', async () => {
    await saveThreads('google', [header('a'), header('b'), header('c', { personal: false })], {
      list: true,
    });
    const summary = await mailQueueSummary();
    expect(summary).toEqual({ count: 2, target: QUEUE_ROUTE });
    expect(Object.keys(summary).sort()).toEqual(['count', 'target']);
    expect(JSON.stringify(summary)).not.toMatch(/Geheim|secret|"a"|"b"/);
    markDone('google', 'a');
    expect((await mailQueueSummary()).count).toBe(1);
  });

  it('a header whose newest message is from the account itself does not count, even without `lastFromMe`', async () => {
    accounts = [
      { key: 'google', connectorId: 'google', email: 'me@example.org', features: ['mail'] },
    ];
    await saveThreads('google', [header('mine', { from: { email: 'me@example.org' } })]);
    expect((await mailQueueSummary()).count).toBe(0);
  });

  it('a disconnected account’s old cache does not count', async () => {
    accounts = [
      { key: 'google#a1', connectorId: 'google', email: 'b@example.org', features: ['mail'] },
    ];
    await saveThreads('google', [header('old')], { list: true });
    expect((await mailQueueSummary()).count).toBe(0);
  });

  it('is 0 without mail, and 0 when the queue is switched off', async () => {
    expect(await mailQueueSummary()).toEqual({ count: 0, target: '/mail?view=waiting' });
    await saveThreads('google', [header('a')], { list: true });
    await setSettings('module.mail', { waitingRule: 'off' });
    expect((await mailQueueSummary()).count).toBe(0);
  });

  it('counts the connected accounts; the demo mailbox only when none is connected', async () => {
    await saveThreads('demo', [header('d1'), header('d2')], { list: true });
    accounts = [];
    expect((await mailQueueSummary()).count).toBe(2);
    accounts = [
      { key: 'google', connectorId: 'google', email: 'me@example.org', features: ['mail'] },
    ];
    await saveThreads('google', [header('g1')], { list: true });
    expect((await mailQueueSummary()).count).toBe(1);
  });
});
