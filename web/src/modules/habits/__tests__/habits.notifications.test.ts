import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setSettings } from '@/core/settings/settings';
import { toEpoch } from '@/core/time/dates';
import { reminderTimes } from '../notifications';
import source from '../notifications';
import { entryRepo, goalRepo, setEntry } from '../repo';

const DAY = '2026-11-03'; // a Tuesday
const range = { from: toEpoch(DAY, '00:00'), to: toEpoch(DAY, '23:59') };

beforeEach(async () => {
  await db.table('habits_goal').clear();
  await db.table('habits_entry').clear();
  await db.table('_settings').clear();
});

const water = () =>
  goalRepo.create({
    name: 'Wasser trinken',
    kind: 'count',
    target: 8,
    unit: 'Gläser',
    period: 'day',
    weeklyTimes: 3,
    order: 0,
    reminder: { kind: 'window', from: '09:00', to: '19:00', everyMin: 120 },
  });

describe('habit reminders', () => {
  it('expands a window into clock times, both ends included', () => {
    expect(reminderTimes({ kind: 'window', from: '09:00', to: '19:00', everyMin: 120 })).toEqual([
      '09:00',
      '11:00',
      '13:00',
      '15:00',
      '17:00',
      '19:00',
    ]);
    expect(reminderTimes({ kind: 'time', time: '08:00' })).toEqual(['08:00']);
  });

  it('asks every two hours inside the window and says how far the day is', async () => {
    const g = await water();
    await setEntry(g.id, DAY, { count: 3 });
    const out = await source(range);
    expect(out).toHaveLength(6);
    expect(out[0]).toMatchObject({
      key: `habit:${g.id}:${DAY}T09:00`,
      title: 'Wasser trinken',
      body: '3 von 8 Gläser',
      url: '/habits',
    });
  });

  it('stops by itself once the day is done, and on a rest day', async () => {
    const g = await water();
    await setEntry(g.id, DAY, { count: 8 });
    expect(await source(range)).toEqual([]);
    await entryRepo.remove(`${g.id}:${DAY}`);
    await setEntry(g.id, DAY, { count: 0, skipped: true });
    expect(await source(range)).toEqual([]);
  });

  it('skips days the goal is not planned and ended or archived goals', async () => {
    const walk = await goalRepo.create({
      name: 'Spazieren',
      kind: 'yesno',
      target: 1,
      period: 'day',
      weekdays: [1], // Monday only
      weeklyTimes: 3,
      order: 1,
      reminder: { kind: 'time', time: '18:00' },
    });
    expect(await source(range)).toEqual([]);
    await goalRepo.update(walk.id, { weekdays: [2] });
    expect((await source(range)).map((n) => n.key)).toEqual([`habit:${walk.id}:${DAY}T18:00`]);
    await goalRepo.update(walk.id, { archived: true });
    expect(await source(range)).toEqual([]);
  });

  it('is silent when the setting is off', async () => {
    await water();
    await setSettings('module.habits', { remindersEnabled: false });
    expect(await source(range)).toEqual([]);
  });
});
