import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { visibleManifests } from '@/core/modules/registry';
import { bookmarkKindFromText } from './adapters';
import { CaptureError, TARGETS, availableTypes, saveCapture, saveCaptures } from './index';

const ON = {
  todos: true,
  calendar: true,
  bookmarks: true,
  notes: true,
  finance: true,
  invoices: true,
  subscriptions: true,
  people: true,
};

beforeEach(async () => {
  setNow(() => new Date(2026, 8, 30, 10, 0).getTime());
  for (const m of visibleManifests) {
    for (const c of Object.keys(m.dataSchema.collections)) await db.table(`${m.id}_${c}`).clear();
  }
  await db.table('_outbox').clear();
});

const rows = (table: string) => db.table(table).toArray();

describe('saveCapture', () => {
  it('writes a todo with the inbox list from the module defaults', async () => {
    await saveCapture('todo', { title: 'Zahnarzt anrufen', date: '2026-10-02' }, { states: ON });
    const [task] = await rows('todos_task');
    expect(task).toMatchObject({
      title: 'Zahnarzt anrufen',
      dueDate: '2026-10-02',
      listId: 'inbox',
    });
  });

  it('keeps a dropped time visible in the todo note', async () => {
    await saveCapture('todo', { title: 'X', time: '15:00' }, { states: ON });
    expect((await rows('todos_task'))[0]!.note).toBe('Uhrzeit: 15:00');
  });

  it('keeps the free text (e.g. the link to a mail) as the note of todo, event, reminder and invoice', async () => {
    const note = 'https://mail.google.com/mail/#all/t1';
    await saveCapture('todo', { title: 'X', time: '15:00', note }, { states: ON });
    await saveCapture('event', { title: 'E', date: '2026-10-01', note }, { states: ON });
    await saveCapture('reminder', { title: 'R', note }, { states: ON });
    await saveCapture('invoice', { title: 'Stadtwerke', amountMinor: 8430, note }, { states: ON });
    expect((await rows('todos_task'))[0]!.note).toBe(`Uhrzeit: 15:00\n${note}`);
    const events = await rows('calendar_event');
    expect(events.map((e) => e.note)).toEqual([note, note]);
    expect((await rows('invoices_invoice'))[0]!.note).toBe(note);
  });

  it('writes no note when there is no free text', async () => {
    await saveCapture('event', { title: 'E', date: '2026-10-01' }, { states: ON });
    await saveCapture('invoice', { title: 'Stadtwerke', amountMinor: 100 }, { states: ON });
    expect('note' in (await rows('calendar_event'))[0]!).toBe(false);
    expect('note' in (await rows('invoices_invoice'))[0]!).toBe(false);
  });

  it('writes a timed event and an all-day event', async () => {
    await saveCapture(
      'event',
      { title: 'Zahnarzt', date: '2026-10-01', time: '15:00' },
      { states: ON },
    );
    await saveCapture('event', { title: 'Urlaub', date: '2026-10-05' }, { states: ON });
    const events = await rows('calendar_event');
    expect(events.find((e) => e.title === 'Zahnarzt')).toMatchObject({
      startTime: '15:00',
      allDay: false,
    });
    expect(events.find((e) => e.title === 'Urlaub')).toMatchObject({ allDay: true });
  });

  it('defaults a missing event/reminder date to today', async () => {
    await saveCapture('reminder', { title: 'Tabletten' }, { states: ON });
    expect((await rows('calendar_event'))[0]).toMatchObject({
      kind: 'reminder',
      startDate: '2026-09-30',
      startTime: '09:00',
      notify: { minutesBefore: 0, enabled: true },
    });
  });

  it('writes a recurring reminder', async () => {
    await saveCapture(
      'reminder',
      {
        title: 'Miete',
        date: '2026-10-01',
        recurrence: { freq: 'monthly', interval: 1, byMonthDay: 1 },
      },
      { states: ON },
    );
    expect((await rows('calendar_event'))[0]!.recurrence).toMatchObject({
      freq: 'monthly',
      byMonthDay: 1,
    });
  });

  it('writes a bookmark and drops non-http links', async () => {
    await saveCapture(
      'bookmark',
      { title: 'Artikel', url: 'https://example.org/a' },
      { states: ON },
    );
    await saveCapture('bookmark', { title: 'Skript', url: 'javascript:alert(1)' }, { states: ON });
    const items = await rows('bookmarks_item');
    expect(items.find((i) => i.title === 'Artikel')!.url).toBe('https://example.org/a');
    expect(items.find((i) => i.title === 'Skript')!.url).toBeUndefined();
  });

  it('a Merkzettel takes its kind from the first word', async () => {
    await saveCapture('bookmark', { title: 'film Dune' }, { states: ON });
    await saveCapture('bookmark', { title: 'Kaufen: Kopfhörer' }, { states: ON });
    await saveCapture('bookmark', { title: 'Buch' }, { states: ON });
    await saveCapture('bookmark', { title: 'Filmabend planen' }, { states: ON });
    const items = await rows('bookmarks_item');
    const kindOf = (title: string) => items.find((i) => i.title === title)?.kind;
    expect(kindOf('Dune')).toBe('watch');
    expect(kindOf('Kopfhörer')).toBe('buy');
    expect(bookmarkKindFromText('Film:Dune')).toEqual({ kind: 'watch', title: 'Dune' });
    // A word alone, or a word that only starts like one, stays the title.
    expect(kindOf('Buch')).toBe('link');
    expect(kindOf('Filmabend planen')).toBe('link');
  });

  it('every kind word of the capture names a kind the Merkliste knows', async () => {
    const { KINDS } = await import('@/modules/bookmarks/schema');
    for (const word of [
      'lesen',
      'artikel',
      'film',
      'serie',
      'ansehen',
      'anschauen',
      'buch',
      'ort',
      'kaufen',
      'ausprobieren',
      'idee',
    ])
      expect(KINDS).toContain(bookmarkKindFromText(`${word} x`).kind);
  });

  it('writes an entry onto the shopping list of the lists module', async () => {
    await saveCapture('list', { title: '2 Milch' }, { states: { ...ON, lists: true } });
    const items = await rows('lists_item');
    expect(items[0]).toMatchObject({ name: '2 Milch', done: false, listId: 'shopping-default' });
    expect((await rows('lists_list'))[0]).toMatchObject({
      id: 'shopping-default',
      kind: 'shopping',
    });
  });

  it('writes a note from shared text', async () => {
    await saveCapture(
      'note',
      { title: 'Idee', note: 'Langer Text', url: 'https://example.org' },
      { states: ON },
    );
    expect((await rows('notes_note'))[0]).toMatchObject({
      title: 'Idee',
      body: 'Langer Text\nhttps://example.org',
    });
  });

  it('books finance only after confirmation and with the primary account', async () => {
    const draft = { title: 'Mittagessen', amountMinor: 1250, kind: 'expense' as const };
    await expect(saveCapture('finance', draft, { states: ON })).rejects.toMatchObject({
      code: 'invalid',
    });
    expect(await rows('finance_transaction')).toHaveLength(0);
    await saveCapture('finance', draft, { states: ON, confirmed: true });
    expect((await rows('finance_transaction'))[0]).toMatchObject({
      amountMinor: 1250,
      kind: 'expense',
      payee: 'Mittagessen',
      date: '2026-09-30',
      accountId: 'acc-main',
    });
  });

  it('writes an open invoice with the due date, without a confirmation step', async () => {
    await saveCapture(
      'invoice',
      { title: 'Swisscom', amountMinor: 8990, date: '2026-10-31' },
      { states: ON },
    );
    expect(TARGETS.invoice.requiresConfirm).toBeFalsy();
    expect((await rows('invoices_invoice'))[0]).toMatchObject({
      payee: 'Swisscom',
      amountMinor: 8990,
      dueDate: '2026-10-31',
      status: 'open',
    });
  });

  it('never books a foreign amount into the euro account; invoices and subscriptions keep it (X21)', async () => {
    const ctx = { today: '2026-09-30' };
    const usd = { title: 'Kaffee', amountMinor: 1200, currency: 'USD' };
    expect(() => TARGETS.finance.build(usd, ctx)).toThrow(CaptureError);
    try {
      TARGETS.finance.build(usd, ctx);
    } catch (e) {
      expect(e).toMatchObject({ code: 'currency', detail: 'USD' });
    }
    expect(TARGETS.invoice.build(usd, ctx)).toMatchObject({ amountMinor: 1200, currency: 'USD' });
    const monthly = { ...usd, recurrence: { freq: 'monthly' as const, interval: 1 } };
    expect(TARGETS.subscription.build(monthly, ctx)).toMatchObject({ currency: 'USD' });
    expect(TARGETS.invoice.build({ ...usd, currency: undefined }, ctx).currency).toBeUndefined();
  });

  it('rejects an invoice without an amount or payee', async () => {
    await expect(
      saveCapture('invoice', { title: 'Swisscom' }, { states: ON }),
    ).rejects.toBeInstanceOf(CaptureError);
    await expect(
      saveCapture('invoice', { title: '', amountMinor: 100 }, { states: ON }),
    ).rejects.toBeInstanceOf(CaptureError);
  });

  it('refuses a disabled module and writes nothing', async () => {
    const err = await saveCapture(
      'bookmark',
      { title: 'X' },
      { states: { ...ON, bookmarks: false } },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CaptureError);
    expect((err as CaptureError).code).toBe('module-off');
    expect(await rows('bookmarks_item')).toHaveLength(0);
  });

  it('rejects empty and impossible input as "invalid"', async () => {
    await expect(saveCapture('todo', { title: '  ' }, { states: ON })).rejects.toMatchObject({
      code: 'invalid',
    });
    await expect(
      saveCapture('event', { title: 'X', date: '2026-13-45' }, { states: ON }),
    ).rejects.toMatchObject({ code: 'invalid' });
  });

  it('queues the write for sync and can undo it', async () => {
    const saved = await saveCapture('todo', { title: 'Sync me' }, { states: ON });
    expect(await db.table('_outbox').count()).toBeGreaterThan(0);
    await saved.undo();
    const [task] = await rows('todos_task');
    expect(task!.deletedAt).toBeTruthy();
  });
});

describe('saveCapture: QA types', () => {
  it('stores the end of a range and sends a night shift into the next day', async () => {
    await saveCapture(
      'event',
      { title: 'Nachtdienst', date: '2026-10-05', time: '21:30', endTime: '06:30' },
      { states: ON },
    );
    expect((await rows('calendar_event'))[0]).toMatchObject({
      startTime: '21:30',
      endTime: '06:30',
      endDate: '2026-10-06',
    });
  });

  it('keeps weekdays, interval and end of a recurring shift', async () => {
    const recurrence = {
      freq: 'weekly' as const,
      interval: 2,
      byWeekday: [1, 2, 3, 4, 5],
      until: '2026-12-31',
    };
    await saveCapture(
      'event',
      { title: 'Frühdienst', date: '2026-10-05', time: '06:00', recurrence },
      { states: ON },
    );
    expect((await rows('calendar_event'))[0]!.recurrence).toMatchObject(recurrence);
  });

  it('writes the priority of a ToDo', async () => {
    await saveCapture('todo', { title: 'Angebot', priority: 3 }, { states: ON });
    expect((await rows('todos_task'))[0]).toMatchObject({ priority: 3 });
  });

  it('writes a subscription and a birthday', async () => {
    await saveCapture(
      'subscription',
      { title: 'Netflix', amountMinor: 1299, recurrence: { freq: 'monthly', interval: 1 } },
      { states: ON },
    );
    expect((await rows('subscriptions_subscription'))[0]).toMatchObject({
      name: 'Netflix',
      amountMinor: 1299,
      startDate: '2026-09-30',
    });
    await saveCapture('birthday', { title: 'Anna', date: '2026-11-14' }, { states: ON });
    expect((await rows('people_person'))[0]).toMatchObject({
      name: 'Anna',
      birthday: { month: 11, day: 14 },
    });
    await expect(saveCapture('birthday', { title: 'Anna' }, { states: ON })).rejects.toMatchObject({
      code: 'invalid',
    });
  });
});

describe('targets', () => {
  it('never points at the password vault', () => {
    for (const target of Object.values(TARGETS)) expect(target.moduleId).not.toBe('accounts');
  });

  it('offers only enabled modules', () => {
    expect(availableTypes({ todos: true, bookmarks: false, calendar: true })).toEqual([
      'todo',
      'event',
      'reminder',
    ]);
    expect(availableTypes(undefined)).toEqual([]);
  });
});

describe('saveCapture: plan (two stages)', () => {
  const PLAN_ON = { ...ON, planner: true };

  it('writes the ToDo through the todo target, then the planner item `todos:<id>` with the pin', async () => {
    const saved = await saveCapture(
      'plan',
      { title: 'Steuer', estimateMin: 120, pin: '2026-10-02', priority: 3 },
      { states: PLAN_ON },
    );
    const [task] = await rows('todos_task');
    expect(task).toMatchObject({ title: 'Steuer', estimateMin: 120, priority: 3, listId: 'inbox' });
    expect(task!.dueDate).toBeUndefined();
    const [item] = await rows('planner_item');
    expect(item).toMatchObject({
      id: `todos:${task!.id}`,
      source: { module: 'todos', id: task!.id },
      pinned: '2026-10-02',
    });
    expect(saved).toMatchObject({ id: task!.id, type: 'plan', moduleId: 'todos' });
  });

  it('a deadline is the ToDo date and a hard due; „ab“ is the ToDo start date', async () => {
    await saveCapture(
      'plan',
      { title: 'Abgabe', date: '2026-10-08', hardDue: true },
      { states: PLAN_ON },
    );
    await saveCapture('plan', { title: 'Keller', startDate: '2026-10-03' }, { states: PLAN_ON });
    const tasks = await rows('todos_task');
    const abgabe = tasks.find((x) => x.title === 'Abgabe')!;
    const keller = tasks.find((x) => x.title === 'Keller')!;
    expect(abgabe.dueDate).toBe('2026-10-08');
    expect(keller.startDate).toBe('2026-10-03');
    const items = await rows('planner_item');
    expect(items.find((i) => i.id === `todos:${abgabe.id}`)!.due).toEqual({
      date: '2026-10-08',
      hard: true,
    });
    expect(items.find((i) => i.id === `todos:${keller.id}`)!.pinned).toBeUndefined();
  });

  it('undo removes both records', async () => {
    const saved = await saveCapture('plan', { title: 'Steuer' }, { states: PLAN_ON });
    await saved.undo();
    expect((await rows('todos_task')).every((x) => x.deletedAt)).toBe(true);
    expect((await rows('planner_item')).every((x) => x.deletedAt)).toBe(true);
  });

  it('needs both modules and writes nothing half', async () => {
    await expect(saveCapture('plan', { title: 'Steuer' }, { states: ON })).rejects.toMatchObject({
      code: 'module-off',
    });
    await expect(saveCapture('plan', { title: ' ' }, { states: PLAN_ON })).rejects.toBeInstanceOf(
      CaptureError,
    );
    expect(await rows('todos_task')).toHaveLength(0);
    expect(availableTypes({ todos: true, planner: true })).toContain('plan');
    expect(availableTypes({ todos: false, planner: true })).not.toContain('plan');
  });
});

describe('saveCapture: break (a blocker of the planner day)', () => {
  const PLAN_ON = { ...ON, planner: true };

  it('appends a blocker to the day row (today, 1 h by default) and writes no ToDo', async () => {
    const saved = await saveCapture('break', { title: 'Pause' }, { states: PLAN_ON });
    const [day] = await rows('planner_day');
    expect(day).toMatchObject({ id: '2026-09-30', date: '2026-09-30' });
    expect(day!.blockers).toEqual([{ id: expect.any(String), label: 'Pause', min: 60 }]);
    expect(await rows('todos_task')).toHaveLength(0);
    expect(saved).toMatchObject({ type: 'break', moduleId: 'planner' });
  });

  it('keeps what the day had, takes the typed length or span, and the undo takes out only this blocker', async () => {
    await saveCapture(
      'break',
      { title: 'Freizeit', date: '2026-10-03', time: '14:00', endTime: '16:00' },
      { states: PLAN_ON },
    );
    const second = await saveCapture(
      'break',
      { title: 'Zocken', date: '2026-10-03', estimateMin: 120 },
      { states: PLAN_ON },
    );
    const [day] = await rows('planner_day');
    expect(day!.blockers.map((b: { label: string; min: number; from?: string }) => b)).toEqual([
      { id: expect.any(String), label: 'Freizeit', min: 120, from: '14:00', to: '16:00' },
      { id: expect.any(String), label: 'Zocken', min: 120 },
    ]);
    await second.undo();
    const [after] = await rows('planner_day');
    expect(after!.blockers.map((b: { label: string }) => b.label)).toEqual(['Freizeit']);
  });

  it('a removed day comes back empty; the undo of a day it brought in removes it again', async () => {
    await db.table('planner_day').put({
      id: '2026-10-04',
      date: '2026-10-04',
      availableMin: 30,
      blockers: [{ id: 'old', label: 'Alt', min: 30 }],
      createdAt: 1,
      updatedAt: 1,
      deviceId: 'x',
      deletedAt: 5,
      _f: {},
    });
    const saved = await saveCapture(
      'break',
      { title: 'Zocken', date: '2026-10-04' },
      { states: PLAN_ON },
    );
    const [day] = await rows('planner_day');
    expect(day).toMatchObject({ deletedAt: null, blockers: [{ label: 'Zocken', min: 60 }] });
    expect(day!.availableMin).toBeUndefined();
    await saved.undo();
    expect((await rows('planner_day'))[0]!.deletedAt).not.toBeNull();
  });

  it('two breaks of one day in one batch: the undo takes both out', async () => {
    const saved = await saveCaptures(
      [
        { type: 'break', fields: { title: 'Zocken', date: '2026-10-03' } },
        {
          type: 'break',
          fields: { title: 'Freizeit', date: '2026-10-03', time: '14:00', endTime: '16:00' },
        },
      ],
      'Pause Sa Zocken\nFreizeit Sa 14 bis 16 Uhr',
      { states: PLAN_ON },
    );
    expect((await rows('planner_day'))[0]!.blockers).toHaveLength(2);
    await saved.undo();
    const [day] = await rows('planner_day');
    expect(day!.deletedAt === null ? day!.blockers : []).toEqual([]);
  });

  it('is there only with the planner on', async () => {
    await expect(saveCapture('break', { title: 'Pause' }, { states: ON })).rejects.toMatchObject({
      code: 'module-off',
    });
    expect(availableTypes({ planner: true })).toContain('break');
    expect(availableTypes({ todos: true })).not.toContain('break');
  });
});

describe('saveCaptures', () => {
  it('saves several entries as one batch with one undo for all', async () => {
    const saved = await saveCaptures(
      [
        { type: 'todo', fields: { title: 'Milch kaufen' } },
        { type: 'todo', fields: { title: 'Oma anrufen' } },
        { type: 'event', fields: { title: 'Zahnarzt', date: '2026-10-02', time: '09:00' } },
      ],
      'Milch kaufen\nOma anrufen\nFreitag Zahnarzt 9 Uhr',
      { states: ON },
    );
    expect(saved.count).toBe(3);
    expect(saved.text).toContain('Oma anrufen');
    const tasks = await rows('todos_task');
    expect(tasks).toHaveLength(2);
    // One inbox for both, not one per entry.
    expect(new Set(tasks.map((x) => x.listId)).size).toBe(1);
    await saved.undo();
    expect((await rows('todos_task')).every((x) => x.deletedAt)).toBe(true);
    expect((await rows('calendar_event')).every((x) => x.deletedAt)).toBe(true);
  });

  it('is all or nothing: a failing entry takes back the ones before it', async () => {
    await expect(
      saveCaptures(
        [
          { type: 'todo', fields: { title: 'Milch kaufen' } },
          { type: 'bookmark', fields: { title: 'Link', url: 'https://example.org' } },
        ],
        'x',
        { states: { ...ON, bookmarks: false } },
      ),
    ).rejects.toBeInstanceOf(CaptureError);
    expect((await rows('todos_task')).every((x) => x.deletedAt)).toBe(true);
  });

  it('refuses bookings without confirmation and an empty batch', async () => {
    await expect(
      saveCaptures([{ type: 'finance', fields: { title: 'Kino', amountMinor: 1250 } }], 'x', {
        states: ON,
      }),
    ).rejects.toBeInstanceOf(CaptureError);
    await expect(saveCaptures([], '', { states: ON })).rejects.toBeInstanceOf(CaptureError);
    expect(await rows('finance_transaction')).toHaveLength(0);
  });

  it('never books: a batch with a finance item writes nothing, even with `confirmed` smuggled in', async () => {
    const sneaky = { states: ON, confirmed: true } as Parameters<typeof saveCaptures>[2];
    await expect(
      saveCaptures(
        [
          { type: 'todo', fields: { title: 'Müll runterbringen' } },
          { type: 'finance', fields: { title: 'Mittagessen', amountMinor: 1250, kind: 'expense' } },
        ],
        'Müll runterbringen\nMittagessen 12,50 € ausgegeben',
        sneaky,
      ),
    ).rejects.toMatchObject({ code: 'invalid' });
    expect(await rows('finance_transaction')).toHaveLength(0);
    expect((await rows('todos_task')).every((x) => x.deletedAt)).toBe(true);
  });
});
