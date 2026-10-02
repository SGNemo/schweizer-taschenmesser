// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { getManifest, visibleManifests } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { eventRepo } from '@/modules/calendar/repo';
import { accountRepo, transactionRepo } from '@/modules/finance/repo';
import { itemRepo as bookmarkRepo } from '@/modules/bookmarks/repo';
import { itemRepo as listItemRepo } from '@/modules/lists/repo';
import { personRepo } from '@/modules/people/repo';
import { documentRepo } from '@/modules/vault/repo';
import { invoiceRepo } from '@/modules/invoices/repo';
import { reminderRepo } from '@/modules/reminders/repo';
import { subscriptionRepo } from '@/modules/subscriptions/repo';
import { externalRepo } from '@/modules/calendar/repo';
import type { MailFinding } from '@/core/connectors/types';
import { INBOX_ID, listRepo, taskRepo } from '@/modules/todos/repo';
import { commitImport } from './batches';
import { buildPreview } from './plan';
import type { ImportInput } from './types';

const TODAY = '2026-09-29'; // a Tuesday

async function run(
  moduleId: string,
  importerId: string,
  input: ImportInput,
  options: Record<string, string> = {},
) {
  const manifest = getManifest(moduleId)!;
  const runtime = (await manifest.contributions!.onboarding!.load!()).default;
  const parsed = await runtime.parse(importerId, input, { today: TODAY, options, batchId: 'tb' });
  const rows = await buildPreview(manifest, runtime, parsed.candidates);
  return { manifest, rows, notes: parsed.notes, runtime };
}

const text = (t: string): ImportInput => ({ kind: 'text', text: t });
const form = (values: Record<string, string>): ImportInput => ({ kind: 'form', values });

beforeEach(async () => {
  setNow(() => new Date(2026, 8, 29, 10, 0).getTime());
  for (const m of visibleManifests) {
    for (const c of Object.keys(m.dataSchema.collections)) await db.table(`${m.id}_${c}`).clear();
  }
  await db.table('_imports').clear();
  await db.table('calendar_external').clear();
  await db.table('_outbox').clear();
});
afterEach(() => setNow());

describe('every module declares onboarding', () => {
  it('has a definition whose importers all have a runtime', async () => {
    for (const m of visibleManifests) {
      const def = m.contributions?.onboarding;
      expect(def, m.id).toBeDefined();
      if (def!.importers.length > 0) {
        const runtime = (await def!.load!()).default;
        expect(typeof runtime.parse, m.id).toBe('function');
        expect(typeof runtime.existingKeys, m.id).toBe('function');
      }
    }
  });
});

describe('todos', () => {
  it('turns pasted lines into tasks of the chosen list and offers the lists', async () => {
    await listRepo.create({ name: 'Inbox', order: 0 }, { id: INBOX_ID });
    const { rows, runtime } = await run(
      'todos',
      'text',
      text('- Steuer sortieren\n[ ] Zahnarzt anrufen\n\n3. Fahrrad reparieren'),
      {
        listId: INBOX_ID,
      },
    );
    expect(rows.map((r) => r.candidate.label)).toEqual([
      'Steuer sortieren',
      'Zahnarzt anrufen',
      'Fahrrad reparieren',
    ]);
    expect(rows.every((r) => r.selected && !r.invalid)).toBe(true);
    expect(await runtime.optionChoices!('listId')).toEqual([{ value: INBOX_ID, label: 'Inbox' }]);
  });

  it('creates the inbox on demand and flags tasks that already exist', async () => {
    const { runtime } = await run('todos', 'text', text('x'));
    const choices = await runtime.optionChoices!('listId');
    expect(choices).toHaveLength(1);
    await taskRepo.create({
      listId: choices[0]!.value,
      title: 'Milch',
      done: false,
      priority: 0,
      order: 0,
    });
    const again = await run('todos', 'text', text('milch\nBrot'), { listId: choices[0]!.value });
    expect(again.rows.map((r) => r.duplicate)).toEqual([true, false]);
  });
});

describe('calendar', () => {
  const ICS = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:1',
    'SUMMARY:Zahnarzt',
    'DTSTART:20261012T083000',
    'DTEND:20261012T093000',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'SUMMARY:Urlaub',
    'DTSTART;VALUE=DATE:20261101',
    'DTEND;VALUE=DATE:20261108',
    'RRULE:FREQ=YEARLY',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'SUMMARY:Komisch',
    'DTSTART:20261201T100000',
    'RRULE:FREQ=MONTHLY;BYDAY=1MO',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  it('previews events, describes them and reports what it could not keep', async () => {
    const { rows, notes } = await run('calendar', 'ics', {
      kind: 'file',
      text: ICS,
      fileName: 'x.ics',
    });
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => !r.invalid)).toBe(true);
    expect(rows[0]!.candidate.detail).toContain('08:30–09:30');
    expect(rows[1]!.candidate.detail).toContain('Jährlich');
    expect(notes).toHaveLength(1); // the unsupported rule
  });

  it('imports through the wizard path and detects the same events on a second run', async () => {
    const first = await run('calendar', 'ics', { kind: 'file', text: ICS, fileName: 'x.ics' });
    await commitImport(first.manifest, {
      batchId: 'tb',
      importerId: 'ics',
      source: 'x.ics',
      rows: first.rows,
    });
    expect(await eventRepo.active().count()).toBe(3);
    const second = await run('calendar', 'ics', { kind: 'file', text: ICS, fileName: 'x.ics' });
    expect(second.rows.every((r) => r.duplicate && !r.selected)).toBe(true);
  });
});

describe('reminders', () => {
  it('computes the next start date of each template from today', async () => {
    const { rows } = await run('reminders', 'templates', {
      kind: 'template',
      ids: ['rent', 'trash', 'insurance', 'energy', 'tax', 'smoke', 'dentist', 'statements'],
    });
    const start = Object.fromEntries(
      rows.map((r) => [r.candidate.label, r.candidate.data.startDate]),
    );
    expect(start['Miete überweisen']).toBe('2026-10-01');
    expect(start['Mülltonne rausstellen']).toBe('2026-10-04'); // next Sunday
    expect(start['Kfz-Versicherung vergleichen']).toBe('2026-11-01');
    expect(start['Strom- und Gasvertrag prüfen']).toBe('2027-09-01');
    expect(start['Steuerunterlagen sammeln']).toBe('2027-06-01');
    expect(start['Rauchmelder testen']).toBe('2027-01-01');
    expect(rows.every((r) => !r.invalid)).toBe(true);
  });

  it('accepts pasted reminders for today and skips unknown template ids', async () => {
    const { rows } = await run('reminders', 'text', text('Reifen wechseln'));
    expect(rows[0]!.candidate.data).toMatchObject({
      title: 'Reifen wechseln',
      startDate: TODAY,
      time: '09:00',
    });
    expect((await run('reminders', 'templates', { kind: 'template', ids: ['nope'] })).rows).toEqual(
      [],
    );
  });

  it('recognises templates that were imported before', async () => {
    const first = await run('reminders', 'templates', { kind: 'template', ids: ['rent'] });
    await commitImport(first.manifest, {
      batchId: 'tb',
      importerId: 'templates',
      source: 't',
      rows: first.rows,
    });
    expect(await reminderRepo.active().count()).toBe(1);
    expect(
      (await run('reminders', 'templates', { kind: 'template', ids: ['rent'] })).rows[0]!.duplicate,
    ).toBe(true);
  });
});

describe('finance', () => {
  it('creates an account with a (possibly negative) opening balance', async () => {
    const { rows, manifest } = await run(
      'finance',
      'account',
      form({ name: 'Sparkonto', balance: '-1.234,56' }),
    );
    expect(rows[0]!.candidate.data).toMatchObject({
      name: 'Sparkonto',
      openingBalanceMinor: -123456,
    });
    await commitImport(manifest, { batchId: 'tb', importerId: 'account', source: 'f', rows });
    expect((await accountRepo.active().toArray()).map((a) => a.name)).toEqual(['Sparkonto']);
  });

  it('explains bad input instead of importing', async () => {
    expect((await run('finance', 'account', form({ name: '', balance: '1' }))).notes).toHaveLength(
      1,
    );
    const bad = await run('finance', 'account', form({ name: 'X', balance: 'viel' }));
    expect(bad.rows).toEqual([]);
    expect(bad.notes[0]).toMatch(/Betrag/);
  });
});

// Invented statement in the layout of the savings banks' CSV export.
const STATEMENT = [
  'Buchungstag;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;Betrag;Waehrung',
  '03.09.26;Streaming Monatsbeitrag;Filmfreund GmbH;-9,99;EUR',
  '03.08.26;Streaming Monatsbeitrag;Filmfreund GmbH;-9,99;EUR',
  '03.07.26;Streaming Monatsbeitrag;Filmfreund GmbH;-9,99;EUR',
  '01.09.26;Gehalt;Beispiel AG;2.345,67;EUR',
  '05.09.26;Kaffee;Baeckerei Muster;-2,50;EUR',
  '05.09.26;Kaffee;Baeckerei Muster;-2,50;EUR',
].join('\n');

describe('bank statement import', () => {
  it('books the statement on the chosen account and treats a second import as duplicates', async () => {
    const acc = await accountRepo.create({ name: 'Giro', openingBalanceMinor: 0, order: 0 });
    const file: ImportInput = { kind: 'file', text: STATEMENT, fileName: 'umsaetze.csv' };
    const first = await run('finance', 'bank', file, { accountId: acc.id });
    expect(first.rows).toHaveLength(6);
    expect(first.rows.every((r) => r.selected && !r.duplicate)).toBe(true); // repeated coffee is not a duplicate
    expect(
      first.rows.find((r) => r.candidate.label === 'Beispiel AG')!.candidate.data,
    ).toMatchObject({
      kind: 'income',
      amountMinor: 234567,
      date: '2026-09-01',
      accountId: acc.id,
    });
    await commitImport(first.manifest, {
      batchId: 'tb',
      importerId: 'bank',
      source: 'f',
      rows: first.rows,
    });
    expect(await transactionRepo.active().count()).toBe(6);

    const second = await run('finance', 'bank', file, { accountId: acc.id });
    expect(second.rows.every((r) => r.duplicate && !r.selected)).toBe(true);
  });

  it('asks for an account and explains an unknown file format', async () => {
    const file = (text: string): ImportInput => ({ kind: 'file', text, fileName: 'x' });
    expect((await run('finance', 'bank', file(STATEMENT), {})).notes[0]).toMatch(/Konto/);
    const acc = await accountRepo.create({ name: 'Giro', openingBalanceMinor: 0, order: 0 });
    const bad = await run('finance', 'bank', file('irgendwas'), { accountId: acc.id });
    expect(bad.rows).toEqual([]);
    expect(bad.notes[0]).toMatch(/Dateiformat/);
  });

  it('offers the accounts as choices', async () => {
    await accountRepo.create({ name: 'Giro', openingBalanceMinor: 0, order: 0 });
    const { runtime } = await run('finance', 'bank', {
      kind: 'file',
      text: STATEMENT,
      fileName: 'x',
    });
    expect((await runtime.optionChoices!('accountId')).map((c) => c.label)).toEqual(['Giro']);
  });

  it('suggests subscriptions from recurring debits only', async () => {
    const r = await run('subscriptions', 'bank', { kind: 'file', text: STATEMENT, fileName: 'x' });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.candidate.data).toMatchObject({
      name: 'Filmfreund GmbH',
      amountMinor: 999,
      startDate: '2026-10-03',
      recurrence: { freq: 'monthly', interval: 1 },
    });
    const none = await run('subscriptions', 'bank', {
      kind: 'file',
      text: 'Buchungstag;Betrag\n01.09.26;-1,00',
      fileName: 'x',
    });
    expect(none.rows).toEqual([]);
    expect(none.notes[0]).toMatch(/keine regelmäßigen/);
  });
});

const findings: MailFinding[] = [
  {
    kind: 'invoice',
    ref: 'gmail:1',
    title: 'Stadtwerke Muster',
    url: 'https://mail.example.test/1',
    mailDate: '2026-09-20',
    amountMinor: 8740,
    date: '2026-10-15',
  },
  { kind: 'invoice', ref: 'gmail:2', title: 'Zahlung ohne Betrag', mailDate: '2026-09-20' },
  {
    kind: 'subscription',
    ref: 'gmail:3',
    title: 'Filmfreund',
    mailDate: '2026-09-21',
    amountMinor: 999,
    freq: 'monthly',
    date: '2026-10-03',
  },
  {
    kind: 'subscription',
    ref: 'gmail:4',
    title: 'Zeitung Jahresabo',
    mailDate: '2026-09-22',
    amountMinor: 5900,
    freq: 'yearly',
  },
  {
    kind: 'contract',
    ref: 'gmail:5',
    title: 'Versicherung Muster',
    mailDate: '2026-09-23',
    date: '2027-12-31',
    noticeDays: 90,
  },
  {
    kind: 'event',
    ref: 'gmail:6',
    title: 'Konzert Beispielband',
    mailDate: '2026-09-24',
    date: '2026-11-21',
    time: '19:30',
    place: 'Stadthalle',
  },
  {
    kind: 'event',
    ref: 'gmail:7',
    title: 'Zahnarzt',
    mailDate: '2026-09-24',
    date: '2026-10-05',
    time: '14:30',
  },
];
const scan: ImportInput = { kind: 'connector', findings };

describe('suggestions from a mail scan', () => {
  it('turns invoice findings into open invoices and skips those without an amount', async () => {
    const r = await run('invoices', 'mail', scan);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.candidate.data).toMatchObject({
      payee: 'Stadtwerke Muster',
      amountMinor: 8740,
      dueDate: '2026-10-15',
      status: 'open',
    });
    expect(String(r.rows[0]!.candidate.data.note)).toContain('https://mail.example.test/1');
    expect(r.notes[0]).toMatch(/ohne erkennbaren Betrag/);
    await commitImport(r.manifest, {
      batchId: 'tb',
      importerId: 'mail',
      source: 'm',
      rows: r.rows,
    });
    expect((await run('invoices', 'mail', scan)).rows[0]!.duplicate).toBe(true);
  });

  it('builds subscriptions with the detected rhythm and flags a guessed start date', async () => {
    const r = await run('subscriptions', 'mail', scan);
    expect(r.rows.map((x) => x.candidate.label)).toEqual(['Filmfreund', 'Zeitung Jahresabo']);
    expect(r.rows[0]!.candidate.data).toMatchObject({
      amountMinor: 999,
      startDate: '2026-10-03',
      recurrence: { freq: 'monthly', interval: 1 },
    });
    expect(r.rows[0]!.candidate.warning).toBeUndefined();
    expect(r.rows[1]!.candidate.data).toMatchObject({
      recurrence: { freq: 'yearly' },
      startDate: '2026-09-22',
    });
    expect(r.rows[1]!.candidate.warning).toBeDefined();
  });

  it('builds contracts as documents with end date and notice period', async () => {
    const r = await run('vault', 'mail', scan);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.candidate.data).toMatchObject({
      title: 'Versicherung Muster',
      category: 'contract',
      endDate: '2027-12-31',
      noticeDays: 90,
    });
    await documentRepo.create({ title: 'versicherung muster', category: 'contract' });
    expect((await run('vault', 'mail', scan)).rows[0]!.duplicate).toBe(true);
  });

  it('suggests events and drops the ones a synced external calendar already has', async () => {
    await externalRepo.create({
      source: 'google',
      calendarId: 'primary',
      extId: 'g1',
      title: 'Zahnarzt',
      allDay: false,
      startDate: '2026-10-05',
      startTime: '14:30',
      kind: 'event',
    });
    const r = await run('calendar', 'mail', scan);
    expect(r.rows.map((x) => [x.candidate.label, x.duplicate])).toEqual([
      ['Konzert Beispielband', false],
      ['Zahnarzt', true],
    ]);
    expect(r.rows[0]!.candidate.data).toMatchObject({
      allDay: false,
      startDate: '2026-11-21',
      startTime: '19:30',
      location: 'Stadthalle',
    });
    expect(r.rows[1]!.selected).toBe(false);
  });
});

describe('invoices and subscriptions', () => {
  it('captures an open invoice and detects the same one again', async () => {
    const input = form({
      payee: 'Stadtwerke',
      amount: '49,90',
      due: '15.11.2026',
      reference: 'R-1',
    });
    const first = await run('invoices', 'form', input);
    expect(first.rows[0]!.candidate.data).toMatchObject({
      payee: 'Stadtwerke',
      amountMinor: 4990,
      dueDate: '2026-11-15',
      status: 'open',
      reference: 'R-1',
    });
    await commitImport(first.manifest, {
      batchId: 'tb',
      importerId: 'form',
      source: 'f',
      rows: first.rows,
    });
    expect(await invoiceRepo.active().count()).toBe(1);
    expect((await run('invoices', 'form', input)).rows[0]!.duplicate).toBe(true);
    expect(
      (await run('invoices', 'form', form({ payee: 'A', amount: '0', due: '15.11.2026' }))).notes,
    ).toHaveLength(1);
    expect(
      (await run('invoices', 'form', form({ payee: 'A', amount: '5', due: 'bald' }))).notes,
    ).toHaveLength(1);
  });

  it('builds the recurrence from the chosen rhythm', async () => {
    const q = await run(
      'subscriptions',
      'form',
      form({
        name: 'Zeitschrift',
        amount: '29,90',
        rhythm: 'quarterly',
        next: '2026-11-01',
        notice: '30',
      }),
    );
    expect(q.rows[0]!.candidate.data).toMatchObject({
      name: 'Zeitschrift',
      amountMinor: 2990,
      recurrence: { freq: 'monthly', interval: 3 },
      startDate: '2026-11-01',
      cancelNoticeDays: 30,
    });
    await commitImport(q.manifest, {
      batchId: 'tb',
      importerId: 'form',
      source: 'f',
      rows: q.rows,
    });
    expect(await subscriptionRepo.active().count()).toBe(1);
    const y = await run(
      'subscriptions',
      'form',
      form({ name: 'Domain', amount: '12', rhythm: 'yearly', next: '01.03.2027' }),
    );
    expect(y.rows[0]!.candidate.data.recurrence).toMatchObject({ freq: 'yearly' });
    expect(
      (
        await run(
          'subscriptions',
          'form',
          form({ name: 'X', amount: '1', rhythm: 'monthly', next: '2026-11-01', notice: '-3' }),
        )
      ).notes,
    ).toHaveLength(1);
  });
});

describe('bookmarks', () => {
  it('reads browser bookmarks and pasted links', async () => {
    const html =
      '<DL><DT><H3>Kochen</H3><DL><DT><A HREF="https://example.org/r">Rezept</A></DL></DL>';
    const file = await run('bookmarks', 'html', { kind: 'file', text: html, fileName: 'b.html' });
    expect(file.rows[0]!.candidate.data).toMatchObject({
      title: 'Rezept',
      url: 'https://example.org/r',
      tags: ['kochen'],
    });

    const pasted = await run(
      'bookmarks',
      'text',
      text('https://example.org/a\nSchöner Weg https://example.org/wandern\nkein link'),
    );
    expect(pasted.rows.map((r) => r.candidate.label)).toEqual([
      'https://example.org/a',
      'Schöner Weg',
    ]);
    expect(pasted.notes).toHaveLength(1);
    await commitImport(pasted.manifest, {
      batchId: 'tb',
      importerId: 'text',
      source: 't',
      rows: pasted.rows,
    });
    expect(await bookmarkRepo.active().count()).toBe(2);
    expect(
      (await run('bookmarks', 'text', text('https://EXAMPLE.org/a/'))).rows[0]!.duplicate,
    ).toBe(true);
  });
});

describe('people, lists', () => {
  it('parses name and date in either order, with or without a year', async () => {
    const { rows, notes, manifest } = await run(
      'people',
      'text',
      text('Anna Beispiel 15.03.1985\nOnkel Max 02.11.\n24.12. Oma\nOhne Datum\n31.02. Fehler'),
    );
    expect(rows.map((r) => r.candidate.data)).toEqual([
      { name: 'Anna Beispiel', birthday: { month: 3, day: 15, year: 1985 } },
      { name: 'Onkel Max', birthday: { month: 11, day: 2 } },
      { name: 'Oma', birthday: { month: 12, day: 24 } },
    ]);
    expect(notes[0]).toMatch(/2 Zeilen/);
    await commitImport(manifest, { batchId: 'tb', importerId: 'text', source: 't', rows });
    expect(await personRepo.active().count()).toBe(3);
    expect((await run('people', 'text', text('anna beispiel 15.03.'))).rows[0]!.duplicate).toBe(
      true,
    );
  });

  it('the shopping list keeps quantities and ignores items already on the open list', async () => {
    const first = await run('lists', 'text', text('2 Milch\nBrot\n500 g Mehl'));
    expect(first.rows.map((r) => r.candidate.data)).toEqual([
      { listId: 'shopping-default', name: 'Milch', done: false, order: 0, quantity: '2' },
      { listId: 'shopping-default', name: 'Brot', done: false, order: 1 },
      { listId: 'shopping-default', name: 'Mehl', done: false, order: 2, quantity: '500 g' },
    ]);
    await commitImport(first.manifest, {
      batchId: 'tb',
      importerId: 'text',
      source: 't',
      rows: first.rows,
    });
    expect(await listItemRepo.active().count()).toBe(3);
    expect((await run('lists', 'text', text('milch'))).rows[0]!.duplicate).toBe(true);
  });
});
