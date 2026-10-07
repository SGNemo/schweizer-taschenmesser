import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { collectCalendarItems, collectNotifications } from '@/core/modules/contributions';
import { toEpoch } from '@/core/time/dates';
import manifest from '../manifest';
import { eventRepo } from '../repo';

beforeEach(async () => {
  await db.table('calendar_event').clear();
  await db.table('_settings').clear();
});

describe('calendar module', () => {
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

describe('event notifications', () => {
  const HOUR = 3_600_000;

  it('fires the given minutes before the start, once per occurrence', async () => {
    await eventRepo.create({
      title: 'Zahnarzt',
      allDay: false,
      startDate: '2026-10-05',
      startTime: '10:00',
      notify: { minutesBefore: 30, enabled: true },
    });
    const at = toEpoch('2026-10-05', '09:30');
    const found = await collectNotifications({ from: at - 1000, to: at + 1000 }, [manifest]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ at, title: 'Zahnarzt' });
    expect(found[0]!.key).toMatch(/^event:.+:2026-10-05T10:00$/);
    expect(await collectNotifications({ from: at + 1000, to: at + HOUR }, [manifest])).toEqual([]);
  });

  it('is silent without notify or when it is paused', async () => {
    await eventRepo.create({
      title: 'A',
      allDay: false,
      startDate: '2026-10-05',
      startTime: '10:00',
    });
    await eventRepo.create({
      title: 'B',
      allDay: false,
      startDate: '2026-10-05',
      startTime: '10:00',
      notify: { minutesBefore: 0, enabled: false },
    });
    const from = toEpoch('2026-10-05', '00:00');
    expect(await collectNotifications({ from, to: from + 24 * HOUR }, [manifest])).toEqual([]);
  });

  it('follows the recurrence and uses the notify time for all-day events', async () => {
    await eventRepo.create({
      title: 'Müll',
      allDay: true,
      startDate: '2026-10-05',
      recurrence: { freq: 'weekly', interval: 1 },
      notify: { minutesBefore: 0, enabled: true },
    });
    const from = toEpoch('2026-10-05', '00:00');
    const found = await collectNotifications({ from, to: from + 15 * 24 * HOUR }, [manifest]);
    expect(found.map((n) => n.at)).toEqual([
      toEpoch('2026-10-05', '09:00'),
      toEpoch('2026-10-12', '09:00'),
      toEpoch('2026-10-19', '09:00'),
    ]);
  });

  it('a day-ahead lead reaches back over midnight', async () => {
    await eventRepo.create({
      title: 'Flug',
      allDay: false,
      startDate: '2026-10-07',
      startTime: '07:00',
      notify: { minutesBefore: 1440, enabled: true },
    });
    const at = toEpoch('2026-10-06', '07:00');
    const found = await collectNotifications({ from: at - 1000, to: at + 1000 }, [manifest]);
    expect(found).toHaveLength(1);
  });
});
