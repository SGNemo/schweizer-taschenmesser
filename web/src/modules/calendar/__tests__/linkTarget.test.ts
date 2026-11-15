import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import target from '../linkTarget';
import { eventRepo } from '../repo';

beforeEach(async () => {
  await db.table('calendar_event').clear();
});

describe('calendar events as a link target', () => {
  it('alive: title and route', async () => {
    const e = await eventRepo.create({ title: 'Zahnarzt', allDay: true, startDate: '2026-11-17' });
    expect(await target.resolve(e.id)).toEqual({
      state: 'alive',
      title: 'Zahnarzt',
      to: `/calendar?open=${e.id}`,
    });
  });

  it('gone: a soft-deleted event and an id that was never here', async () => {
    const e = await eventRepo.create({ title: 'Weg', allDay: true, startDate: '2026-11-17' });
    await eventRepo.remove(e.id);
    expect(await target.resolve(e.id)).toEqual({ state: 'gone' });
    expect(await target.resolve('never-here')).toEqual({ state: 'gone' });
  });

  it('a malformed id is gone', async () => {
    expect(await target.resolve('a b/../?open=<x>')).toEqual({ state: 'gone' });
    expect(await target.resolve('')).toEqual({ state: 'gone' });
  });
});
