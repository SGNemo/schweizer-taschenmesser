// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import type { MailMessage, MailThreadSummary } from '@/core/mail/types';
import { setNow } from '@/core/time/now';
import { clearMailCache, patchCachedThread, saveBody, saveThreads } from '../cache';
import { threadRepo, bodyRepo } from '../repo';
import {
  dropSearchIndex,
  heldIndexes,
  highlightParts,
  parseQuery,
  searchLocal,
  withinEdits,
} from '../searchIndex';

const DAY = 86_400_000;
const NOW = new Date('2026-11-23T10:00:00').getTime();

const thread = (
  id: string,
  daysAgo: number,
  extra: Partial<MailThreadSummary> = {},
): MailThreadSummary => ({
  id,
  messageCount: 1,
  from: { name: 'Kita Pusteblume', email: 'leitung@kita.example.org' },
  subject: `Elternabend ${id}`,
  snippet: 'Liebe Eltern',
  date: NOW - daysAgo * DAY,
  unread: false,
  labelIds: ['INBOX'],
  hasAttachment: false,
  ...extra,
});

const message = (id: string, threadId: string, extra: Partial<MailMessage> = {}): MailMessage => ({
  id,
  threadId,
  from: { email: 'info@hausverwaltung.example.org' },
  to: [{ email: 'me@example.org' }],
  cc: [],
  subject: 'Unterlagen wie besprochen',
  date: NOW,
  labelIds: [],
  unread: false,
  text: 'Guten Tag, anbei die Unterlagen wie am Telefon besprochen.',
  attachments: [],
  inline: [],
  ...extra,
});

beforeEach(async () => {
  setNow(() => NOW);
  await db.table('mail_thread').clear();
  await db.table('mail_body').clear();
  await db.table('_outbox').clear();
  dropSearchIndex();
});
afterEach(() => {
  setNow(undefined);
  vi.restoreAllMocks();
});

describe('query parsing (the operators the device can answer)', () => {
  const cases: [string, Partial<ReturnType<typeof parseQuery>>][] = [
    ['Rechnung Wasser', { words: ['rechnung', 'wasser'] }],
    ['"Rechnung Wasser"', { words: ['rechnung wasser'] }],
    ['from:Pusteblume', { from: ['pusteblume'] }],
    ['from:"Kita Pusteblume"', { from: ['kita pusteblume'] }],
    ['filename:mietvertrag', { filename: ['mietvertrag'] }],
    ['has:attachment is:unread', { flags: { attachment: true, unread: true } }],
    [
      'is:read is:starred is:important in:inbox',
      { flags: { unread: false, starred: true, important: true, inbox: true } },
    ],
    ['newer_than:7d', { after: NOW - 7 * DAY }],
    ['older_than:1y', { before: NOW - 365 * DAY }],
    [
      'after:2026/03/01 before:2026-06-01',
      { after: new Date(2026, 2, 1).getTime(), before: new Date(2026, 5, 1).getTime() },
    ],
    ['to:anna size:5m -from:x', { unsupported: ['to:anna', 'size:5m', '-from:x'] }],
    ['rechnung OR mahnung', { words: ['rechnung', 'mahnung'], unsupported: ['OR'] }],
    ['-newsletter {a b}', { unsupported: ['-newsletter', '{a', 'b}'] }],
    ['label:Rechnungen', { labels: [], unsupported: ['label:Rechnungen'] }],
    ['label:starred label:CATEGORY_PROMOTIONS', { labels: ['starred', 'category_promotions'] }],
    ['Müller Straße', { words: ['muller', 'strasse'] }],
  ];
  it.each(cases)('%s', (q, want) => {
    setNow(() => NOW);
    expect(parseQuery(q)).toMatchObject(want);
  });
});

describe('typo tolerance (names only)', () => {
  it.each([
    ['pusteblme', 'pusteblume', 2, true],
    ['pusteblume', 'pusteblume', 0, true],
    ['jana', 'jane', 1, true],
    ['jana', 'joni', 1, false],
    ['rechnug', 'malte', 1, false],
  ] as const)('%s ~ %s within %i: %s', (a, b, max, ok) => {
    expect(withinEdits(a, b, max)).toBe(ok);
  });
});

describe('the index on this device', () => {
  it('finds by sender (with a typo), subject, preview, text and attachment name', async () => {
    await saveThreads('google', [
      thread('kita', 2),
      thread('lease', 60, {
        from: { name: 'Hausverwaltung Muster', email: 'info@hausverwaltung.example.org' },
        subject: 'Unterlagen wie besprochen',
        snippet: 'anbei',
      }),
    ]);
    await saveBody(
      'google',
      message('m1', 'lease', {
        attachments: [
          { id: 'a1', filename: 'Mietvertrag_Nachtrag_2026.pdf', mime: 'application/pdf', size: 9 },
        ],
      }),
    );
    const ids = async (q: string) => (await searchLocal('google', q)).hits.map((h) => h.thread.id);
    expect(await ids('Pusteblume')).toEqual(['kita']);
    expect(await ids('Pusteblme')).toEqual(['kita']); // one letter missing in a name
    expect(await ids('from:pusteblme')).toEqual(['kita']);
    expect(await ids('Elternabend')).toEqual(['kita']);
    expect(await ids('liebe eltern')).toEqual(['kita']);
    expect(await ids('Telefon')).toEqual(['lease']); // only in the opened mail's text
    expect(await ids('Elternabnd')).toEqual([]); // typos are forgiven in names, not in subjects

    const file = await searchLocal('google', 'Mietvertrag');
    expect(file.hits.map((h) => [h.thread.id, h.line, h.thread.hasAttachment])).toEqual([
      ['lease', { kind: 'file', text: 'Mietvertrag_Nachtrag_2026.pdf' }, true],
    ]);
    expect((await searchLocal('google', 'has:attachment')).hits.map((h) => h.thread.id)).toEqual([
      'lease',
    ]);
    const text = await searchLocal('google', 'telefon');
    expect(text.hits[0]!.line).toEqual({ kind: 'text', text: expect.stringContaining('Telefon') });
    expect(text.searched).toBe(2);
  });

  it('a domain is no name: free words look at the name and the address before the @, `from:` at all of it', async () => {
    await saveThreads('google', [
      thread('a', 1, { from: { name: 'Anna Beispiel', email: 'anna.b@webmail.example.org' } }),
    ]);
    const ids = async (q: string) => (await searchLocal('google', q)).hits.map((h) => h.thread.id);
    expect(await ids('webmail')).toEqual([]);
    expect(await ids('webmial')).toEqual([]); // no typo match on a domain either
    expect(await ids('anna.b')).toEqual(['a']);
    expect(await ids('from:webmail')).toEqual(['a']);
    // a name found with a typo is handed back for marking
    expect((await searchLocal('google', 'Beispeil')).terms).toContain('beispiel');
  });

  it('reads an HTML-only mail as text (entities decoded) and cuts the excerpt at the right place after „ß“', async () => {
    await saveThreads('google', [thread('h', 1)]);
    await saveBody(
      'google',
      message('m1', 'h', {
        text: undefined,
        html: '<style>.x{}</style><p>Grüße aus der Straße &amp; mehr: Fälligkeit &lt;31.12.&gt; für den Zählerstand</p>',
      }),
    );
    const r = await searchLocal('google', 'zahlerstand');
    expect(r.hits[0]!.line).toEqual({ kind: 'text', text: expect.stringContaining('Zählerstand') });
    expect(r.hits[0]!.line!.text).toContain('<31.12.>');
    expect(r.hits[0]!.line!.text).not.toContain('.x{}');
  });

  it('a delete while the index is being built leaves nothing in memory', async () => {
    await saveThreads('google', [thread('a', 1)]);
    const running = searchLocal('google', 'elternabend');
    await clearMailCache();
    await running;
    expect(heldIndexes()).toBe(0);
  });

  it('answers the filters and keeps newest first', async () => {
    await saveThreads('google', [
      thread('old', 400),
      thread('week', 3, { unread: true, labelIds: ['INBOX', 'UNREAD', 'STARRED'] }),
      thread('month', 20),
    ]);
    const ids = async (q: string) => (await searchLocal('google', q)).hits.map((h) => h.thread.id);
    expect(await ids('elternabend')).toEqual(['week', 'month', 'old']);
    expect(await ids('newer_than:7d')).toEqual(['week']);
    expect(await ids('older_than:1y')).toEqual(['old']);
    expect(await ids('is:unread')).toEqual(['week']);
    expect(await ids('is:starred elternabend')).toEqual(['week']);
    expect(await ids('label:starred')).toEqual(['week']);
  });

  it('claims nothing for operators only the mailbox can answer, and nothing for an empty search', async () => {
    await saveThreads('google', [thread('kita', 2)]);
    const r = await searchLocal('google', 'to:anna Pusteblume');
    expect(r.hits).toEqual([]);
    expect(r.unsupported).toEqual(['to:anna']);
    expect((await searchLocal('google', '   ')).hits).toEqual([]);
  });

  it('follows the cache: a new header, a changed label, and the delete (index gone with it)', async () => {
    await saveThreads('google', [thread('a', 1)]);
    expect((await searchLocal('google', 'is:starred')).hits).toEqual([]);
    await patchCachedThread('google', 'a', { addLabelIds: ['STARRED'] });
    expect((await searchLocal('google', 'is:starred')).hits.map((h) => h.thread.id)).toEqual(['a']);
    await saveThreads('google', [thread('b', 0, { subject: 'Neu da' })]);
    expect((await searchLocal('google', 'neu')).hits.map((h) => h.thread.id)).toEqual(['b']);

    expect(heldIndexes()).toBe(1);
    await clearMailCache();
    expect(heldIndexes()).toBe(0); // the copy in memory goes with the cache
    expect((await searchLocal('google', 'elternabend')).hits).toEqual([]);
    expect((await searchLocal('google', 'neu')).searched).toBe(0);
  });

  it('keeps the accounts apart', async () => {
    await saveThreads('google', [thread('a', 1)]);
    await saveThreads('google#a1', [thread('b', 1, { subject: 'Anderes Konto' })]);
    expect((await searchLocal('google', 'konto')).hits).toEqual([]);
    expect((await searchLocal('google#a1', 'konto')).hits.map((h) => h.thread.id)).toEqual(['b']);
  });

  it('works offline: no request leaves the page, nothing is written anywhere', async () => {
    await saveThreads('google', [thread('a', 1)]);
    await saveBody('google', message('m1', 'a'));
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const storageKeys = Object.keys(localStorage).sort();
    const before = [
      await threadRepo.table.count(),
      await bodyRepo.table.count(),
      await db.table('_outbox').count(),
    ];
    const r = await searchLocal('google', 'Telefon');
    expect(r.hits).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(Object.keys(localStorage).sort()).toEqual(storageKeys);
    expect([
      await threadRepo.table.count(),
      await bodyRepo.table.count(),
      await db.table('_outbox').count(),
    ]).toEqual(before);
    // The rows on disk stay sealed: the index never wrote the words in the clear.
    const raw =
      JSON.stringify(await threadRepo.table.toArray()) +
      JSON.stringify(await bodyRepo.table.toArray());
    expect(raw).not.toMatch(/Pusteblume|Telefon/);
  });

  it('5 000 mails: the index builds and answers without a noticeable wait', async () => {
    const rows = Array.from({ length: 5000 }, (_, i) => ({
      id: `demo|t${i}`,
      createdAt: 1,
      updatedAt: 1,
      deviceId: 'test',
      deletedAt: null,
      _f: {},
      accountKey: 'demo',
      threadId: `t${i}`,
      sortKey: NOW - i * 3_600_000,
      unread: i % 7 === 0,
      inbox: true,
      demo: {
        from: { name: `Absender ${i % 97}`, email: `a${i % 97}@example.org` },
        subject: `Betreff ${i} ${i % 50 === 0 ? 'Rechnung' : 'Hallo'}`,
        snippet: 'Ein kurzer Vorschautext für die Liste',
        messageCount: 1,
        hasAttachment: i % 9 === 0,
        labelIds: ['INBOX'],
      },
    }));
    await db.table('mail_thread').bulkPut(rows);
    const t0 = performance.now();
    const first = await searchLocal('demo', 'rechnung');
    const built = performance.now() - t0;
    const t1 = performance.now();
    const second = await searchLocal('demo', 'absendr 42'); // typo in a name, the index is warm
    const warm = performance.now() - t1;
    expect(first.hits).toHaveLength(100);
    expect(second.hits.length).toBeGreaterThan(0);
    expect(first.searched).toBe(5000);
    // Generous bounds for a busy CI runner; locally ≈ 10× faster.
    expect(built).toBeLessThan(3000);
    expect(warm).toBeLessThan(1000);
    console.info(
      `mail index: 5 000 mails built in ${Math.round(built)} ms, warm search ${Math.round(warm)} ms`,
    );
  }, 60_000);
});

describe('highlighting (text parts, never HTML)', () => {
  it('marks hits case- and accent-blind and keeps the original spelling', () => {
    expect(highlightParts('Kita Pusteblume', ['pusteblume'])).toEqual([
      { text: 'Kita ', hit: false },
      { text: 'Pusteblume', hit: true },
    ]);
    expect(highlightParts('Müller & Straße', ['muller', 'strasse'])).toEqual([
      { text: 'Müller', hit: true },
      { text: ' & ', hit: false },
      { text: 'Straße', hit: true },
    ]);
  });

  it('keeps markup as plain text', () => {
    const parts = highlightParts('<img src=x onerror=alert(1)> Rechnung', ['rechnung']);
    expect(parts).toEqual([
      { text: '<img src=x onerror=alert(1)> ', hit: false },
      { text: 'Rechnung', hit: true },
    ]);
  });

  it('without terms the text stays one part', () => {
    expect(highlightParts('Hallo', [])).toEqual([{ text: 'Hallo', hit: false }]);
  });
});
