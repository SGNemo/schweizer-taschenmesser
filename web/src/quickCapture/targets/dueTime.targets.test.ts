import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { parseCapture } from '../parser';
import { previewChips } from '../ui/chips';
import { saveCapture, saveCaptures } from './index';

const ON = { todos: true, calendar: true, planner: true };
const NOW = new Date(2026, 9, 29, 10, 0);

beforeEach(async () => {
  setNow(() => NOW.getTime());
  await db.table('calendar_event').clear();
  await db.table('todos_task').clear();
  await db.table('planner_item').clear();
});

const tasks = () => db.table('todos_task').toArray();

describe('a deadline with an hour (package 5b)', () => {
  it('„Team-Sachen lesen bis So 18:00“: a ToDo, deadline Sunday, dueTime 18:00, no note line', async () => {
    const r = parseCapture('Team-Sachen lesen bis So 18:00', { now: NOW });
    expect(r.type).toBe('todo');
    expect(r.fields).toMatchObject({ date: '2026-11-01', time: '18:00', deadline: true });
    // The preview says it is a deadline.
    expect(previewChips(r.fields, r.type, r.notes, '2026-10-29').map((c) => c.label)).toContain(
      'Frist So., 1. Nov.',
    );
    await saveCapture(r.type, r.fields, { states: ON });
    const [task] = await tasks();
    expect(task).toMatchObject({
      title: 'Team-Sachen lesen',
      dueDate: '2026-11-01',
      dueTime: '18:00',
    });
    expect(task.note).toBeUndefined();
    expect(task.dueRemind).toBeUndefined();
  });

  it('a time without „bis/spätestens <Tag>“ stays a note line, as before', async () => {
    const r = parseCapture('t Mama anrufen Fr 18:00', { now: NOW });
    expect(r.fields.deadline).toBeUndefined();
    await saveCapture('todo', r.fields, { states: ON });
    const [task] = await tasks();
    expect(task.dueTime).toBeUndefined();
    expect(task.note).toBe('Uhrzeit: 18:00');
  });

  it('the counter lines keep their shape: a span, an appointment, a day without hour', () => {
    expect(parseCapture('Fr 18 Uhr bis So Hütte', { now: NOW }).fields.deadline).toBeUndefined();
    expect(parseCapture('Mo 9:30 Teamrunde', { now: NOW }).fields.deadline).toBeUndefined();
    expect(parseCapture('Termin bis 18 Uhr', { now: NOW }).fields.deadline).toBeUndefined();
    const day = parseCapture('Team-Sachen lesen bis Sonntag', { now: NOW });
    expect(day.fields).toMatchObject({ date: '2026-11-01', deadline: true });
    expect(day.fields.time).toBeUndefined();
  });

  it('a plan capture „p … bis So 18:00“ puts the hour on the ToDo and the plan row', async () => {
    const r = parseCapture('p Steuer bis So 18:00', { now: NOW });
    expect(r.type).toBe('plan');
    const saved = await saveCapture('plan', r.fields, { states: ON });
    const [task] = await tasks();
    expect(task).toMatchObject({ dueDate: '2026-11-01', dueTime: '18:00' });
    const row = await db.table('planner_item').get(`todos:${saved.id}`);
    expect(row.due).toEqual({ date: '2026-11-01', hard: true, time: '18:00' });
  });
});

describe('a batch keeps the typed line order (CHECK-1-3 C4)', () => {
  it('ToDos saved in the same millisecond get ids in line order', async () => {
    const lines = [
      'Bude aufräumen',
      'Duschen',
      'Pfand',
      'Wäsche',
      'Steuer',
      'Bericht',
      'Einkauf',
      'Mails',
      'Rasen',
      'Keller',
      'Fenster',
      'Blumen',
    ];
    // The clock stands still: every ToDo has the same age, only the id can keep the order.
    await saveCaptures(
      lines.map((title) => ({ type: 'todo' as const, fields: { title } })),
      lines.join('\n'),
      { states: ON },
    );
    const rows = await tasks();
    expect(new Set(rows.map((r) => r.createdAt)).size).toBe(1);
    const byId = [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    expect(byId.map((r) => r.title)).toEqual(lines);
  });

  it('a given id stays as it was', async () => {
    await saveCaptures(
      [
        { type: 'todo', fields: { title: 'Fest' }, id: 'fixed-id' },
        { type: 'todo', fields: { title: 'Neu' } },
      ],
      'Fest\nNeu',
      { states: ON },
    );
    expect((await tasks()).map((r) => r.id)).toContain('fixed-id');
  });
});
