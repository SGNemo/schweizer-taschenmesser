import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { visibleManifests } from '@/core/modules/registry';
import { CaptureError, TARGETS, availableTypes, saveCapture } from './index';

const ON = {
  todos: true,
  calendar: true,
  reminders: true,
  bookmarks: true,
  notes: true,
  finance: true,
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
    expect((await rows('reminders_reminder'))[0]).toMatchObject({
      startDate: '2026-09-30',
      time: '09:00',
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
    expect((await rows('reminders_reminder'))[0]!.recurrence).toMatchObject({
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

describe('targets', () => {
  it('never points at the password vault', () => {
    for (const target of Object.values(TARGETS)) expect(target.moduleId).not.toBe('accounts');
  });

  it('offers only enabled modules', () => {
    expect(availableTypes({ todos: true, bookmarks: false, calendar: true })).toEqual([
      'todo',
      'event',
    ]);
    expect(availableTypes(undefined)).toEqual([]);
  });
});
