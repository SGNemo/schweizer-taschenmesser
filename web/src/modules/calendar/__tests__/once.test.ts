import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { runMigrations } from '@/core/modules/migrate';
import { patchFocusSettings } from '@/core/settings/focus';
import { toEpoch } from '@/core/time/dates';
import calendarManifest from '../manifest';
import source from '../notifications';
import { eventRepo } from '../repo';
import { eventSchema } from '../schema';

const base = {
  title: 'krankmelden',
  kind: 'reminder' as const,
  allDay: false,
  startDate: '2026-10-05',
  startTime: '07:30',
};

beforeEach(async () => {
  await db.table('calendar_event').clear();
  await db.table('_settings').clear();
  await db.table('_meta').clear();
});

describe('„einmal“ (once) reminders', () => {
  it('once never repeats: one notification at its time, even with stages and follow-up on', async () => {
    await patchFocusSettings({ staggered: true, stages: [60, 10], followUp: true });
    const e = await eventRepo.create({
      ...base,
      once: true,
      notify: { enabled: true, minutesBefore: 0, extraMinutes: [1440] },
    });
    // A whole week around it: no lead, no stage, no repeat ever comes.
    const out = await source({
      from: toEpoch('2026-10-01', '00:00'),
      to: toEpoch('2026-10-08', '00:00'),
    });
    expect(out).toEqual([
      expect.objectContaining({
        key: `event:${e.id}:2026-10-05T07:30`,
        at: toEpoch('2026-10-05', '07:30'),
        title: 'krankmelden',
      }),
    ]);
  });

  it('a reminder without once keeps the global rule (stages and repeats)', async () => {
    await patchFocusSettings({ staggered: true, stages: [60], followUp: true });
    const e = await eventRepo.create({ ...base, notify: { enabled: true, minutesBefore: 0 } });
    const out = await source({
      from: toEpoch('2026-10-05', '00:00'),
      to: toEpoch('2026-10-06', '00:00'),
    });
    const keys = out.map((n) => n.key);
    expect(keys).toContain(`event:${e.id}:2026-10-05T07:30:s60`);
    expect(keys.some((k) => /:r1$/.test(k))).toBe(true);
  });

  it('migration to version 5 keeps every stored event as it was (lossless, no once added)', async () => {
    await db.table('_meta').put({ key: 'moduleVersion.calendar', value: 4 });
    const old = await eventRepo.create({ ...base, notify: { enabled: true, minutesBefore: 5 } });
    const before = await eventRepo.get(old.id);
    await runMigrations(calendarManifest, db);
    expect((await db.table('_meta').get('moduleVersion.calendar'))?.value).toBe(5);
    const after = await eventRepo.get(old.id);
    expect(after).toEqual(before);
    expect(after?.once).toBeUndefined();
    expect(eventSchema.safeParse(after).success).toBe(true);
  });
});
