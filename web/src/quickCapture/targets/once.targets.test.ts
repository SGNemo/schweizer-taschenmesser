import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { parseCapture } from '../parser';
import { saveCapture, saveCaptures } from './index';

const ON = { todos: true, calendar: true };
const NOW = new Date(2026, 9, 29, 10, 0);

beforeEach(async () => {
  setNow(() => NOW.getTime());
  await db.table('calendar_event').clear();
  await db.table('todos_task').clear();
});

const events = () => db.table('calendar_event').toArray();

describe('„einmal“: reminders from the quick capture (package 5a, W06)', () => {
  it('every reminder the capture makes carries once', async () => {
    await saveCapture('reminder', { title: 'Tabletten', time: '08:00' }, { states: ON });
    expect((await events())[0]).toMatchObject({ kind: 'reminder', once: true });
  });

  it('„erinnere mich“ is the only trigger word: the title is the text without day, time and the words', async () => {
    const r = parseCapture('Mo 7:30 erinnere mich: krankmelden', { now: NOW });
    expect(r.type).toBe('reminder');
    expect(r.fields).toMatchObject({ title: 'Krankmelden', date: '2026-11-02', time: '07:30' });
    await saveCapture(r.type!, r.fields, { states: ON });
    const [ev] = await events();
    expect(ev).toMatchObject({
      title: 'Krankmelden',
      kind: 'reminder',
      once: true,
      startDate: '2026-11-02',
      startTime: '07:30',
    });
    // No health field, category or inference: only what the person typed.
    expect(Object.keys(ev).filter((k) => /health|categor|sick|krank/i.test(k))).toEqual([]);
  });

  it('„falls nötig“ is no trigger word; the same line picked as „Erinnerung“ is a reminder with once', async () => {
    const r = parseCapture('Mo 7:30 krankmelden falls nötig', { now: NOW });
    expect(r.type).toBe('event');
    // The preview row's one pick: the fields stay as read, only the target changes.
    await saveCaptures(
      [{ type: 'reminder', fields: r.fields }],
      'Mo 7:30 krankmelden falls nötig',
      {
        states: ON,
      },
    );
    expect((await events())[0]).toMatchObject({
      kind: 'reminder',
      once: true,
      startDate: '2026-11-02',
      startTime: '07:30',
    });
  });

  it('the counter lines stay appointments without once', async () => {
    for (const text of ['Fr 20 Uhr Kino mit Anna', 'Mo 9:30 Teamrunde']) {
      const r = parseCapture(text, { now: NOW });
      expect(r.type, text).toBe('event');
      await saveCapture('event', r.fields, { states: ON });
    }
    const all = await events();
    expect(all).toHaveLength(2);
    expect(all.every((e) => e.kind === undefined && e.once === undefined)).toBe(true);
  });
});
