import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { collectCalendarItems, collectNotifications } from '@/core/modules/contributions';
import { validateManifest } from '@/core/modules/registry';
import { toEpoch } from '@/core/time/dates';
import manifest from '../manifest';
import { reminderRepo } from '../repo';
import { reminderSchema } from '../schema';

beforeEach(async () => {
  await db.table('reminders_reminder').clear();
});

describe('reminders module', () => {
  it('has a valid manifest', () => {
    expect(validateManifest(manifest)).toEqual([]);
  });

  it('validates data and applies defaults', () => {
    expect(reminderSchema.safeParse({ title: 'x', startDate: 'morgen' }).success).toBe(false);
    expect(
      reminderSchema.safeParse({ title: 'x', startDate: '2026-01-01', time: '25:00' }).success,
    ).toBe(false);
    expect(reminderSchema.parse({ title: 'x', startDate: '2026-01-01' })).toMatchObject({
      time: '09:00',
      active: true,
    });
  });

  it('puts recurring reminders on the calendar and skips paused ones', async () => {
    await reminderRepo.create({
      title: 'Miete',
      startDate: '2026-01-01',
      time: '08:00',
      recurrence: { freq: 'monthly', interval: 1, byMonthDay: 1 },
      active: true,
    });
    await reminderRepo.create({
      title: 'Pausiert',
      startDate: '2026-02-01',
      time: '08:00',
      active: false,
    });
    const items = await collectCalendarItems({ from: '2026-02-01', to: '2026-03-31' }, [manifest]);
    expect(items.map((i) => [i.title, i.date, i.time])).toEqual([
      ['Miete', '2026-02-01', '08:00'],
      ['Miete', '2026-03-01', '08:00'],
    ]);
    expect(items[0]).toMatchObject({ kind: 'reminder', allDay: false, source: 'reminders' });
  });

  it('notifies once per occurrence inside (from, to]', async () => {
    await reminderRepo.create({
      title: 'Tabletten',
      note: 'Mit Wasser',
      startDate: '2026-05-01',
      time: '20:00',
      recurrence: { freq: 'daily', interval: 1 },
      active: true,
    });
    const from = toEpoch('2026-05-03', '19:59');
    const to = toEpoch('2026-05-04', '20:00');
    const due = await collectNotifications({ from, to }, [manifest]);
    expect(due.map((d) => d.key)).toEqual([
      'reminder:' + (await reminderRepo.active().first())!.id + ':2026-05-03T20:00',
      'reminder:' + (await reminderRepo.active().first())!.id + ':2026-05-04T20:00',
    ]);
    expect(due[0]).toMatchObject({ title: 'Tabletten', body: 'Mit Wasser', url: '/reminders' });
    // Exclusive lower bound: a window starting exactly at the occurrence does not repeat it.
    expect(
      await collectNotifications(
        { from: toEpoch('2026-05-03', '20:00'), to: toEpoch('2026-05-03', '20:30') },
        [manifest],
      ),
    ).toEqual([]);
  });
});
