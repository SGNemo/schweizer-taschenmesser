import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { collectCalendarItems } from '@/core/modules/contributions';
import { validateManifest } from '@/core/modules/registry';
import manifest from '../manifest';
import { eventRepo } from '../repo';

beforeEach(async () => {
  await db.table('calendar_event').clear();
});

describe('calendar module', () => {
  it('has a valid manifest', () => {
    expect(validateManifest(manifest)).toEqual([]);
  });

  it('contributes its own events, including recurrence and deleted ones excluded', async () => {
    await eventRepo.create({
      title: 'Zahnarzt',
      allDay: false,
      startDate: '2026-09-29',
      startTime: '14:30',
    });
    await eventRepo.create({
      title: 'Stammtisch',
      allDay: false,
      startDate: '2026-09-01',
      startTime: '19:00',
      recurrence: { freq: 'weekly', interval: 1 },
    });
    const gone = await eventRepo.create({ title: 'Weg', allDay: true, startDate: '2026-09-30' });
    await eventRepo.remove(gone.id);

    const items = await collectCalendarItems({ from: '2026-09-28', to: '2026-09-30' }, [manifest]);
    expect(items.map((i) => [i.date, i.time, i.title])).toEqual([
      ['2026-09-29', '14:30', 'Zahnarzt'],
      ['2026-09-29', '19:00', 'Stammtisch'],
    ]);
  });
});
