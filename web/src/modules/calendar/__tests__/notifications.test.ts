import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { ackNotification } from '@/core/notifications/ack';
import { patchFocusSettings } from '@/core/settings/focus';
import { toEpoch } from '@/core/time/dates';
import source from '../notifications';
import { eventRepo } from '../repo';

const range = { from: toEpoch('2026-10-05', '00:00'), to: toEpoch('2026-10-06', '00:00') };
const keys = async () => (await source(range)).map((n) => n.key).sort();

async function reminder(over: Record<string, unknown> = {}) {
  return eventRepo.create({
    title: 'Paket abholen',
    kind: 'reminder',
    allDay: false,
    startDate: '2026-10-05',
    startTime: '13:00',
    notify: { enabled: true, minutesBefore: 10 },
    ...over,
  } as never);
}

beforeEach(async () => {
  await db.table('calendar_event').clear();
  await db.table('_settings').clear();
  await db.table('_meta').clear();
});

describe('calendar notifications', () => {
  it("default: one notification at the event's own lead", async () => {
    await patchFocusSettings({ followUp: false }); // repeats are on by default, tested below
    const e = await reminder();
    const out = await source(range);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      key: `event:${e.id}:2026-10-05T13:00`,
      at: toEpoch('2026-10-05', '12:50'),
      title: 'Paket abholen',
    });
    expect(out[0]!.soft).toBeUndefined();
  });

  it('staggered: soft extras at the chosen lead times, never twice at the own lead', async () => {
    const e = await reminder();
    await patchFocusSettings({ followUp: false, staggered: true, stages: [1440, 60, 10] });
    const out = await source({ from: toEpoch('2026-10-04', '00:00'), to: range.to });
    const base = `event:${e.id}:2026-10-05T13:00`;
    expect(out.map((n) => n.key).sort()).toEqual([base, `${base}:s1440`, `${base}:s60`].sort());
    const hour = out.find((n) => n.key.endsWith(':s60'))!;
    expect(hour).toMatchObject({
      at: toEpoch('2026-10-05', '12:00'),
      soft: true,
      body: 'In 1 Std · 13:00',
    });
    expect(out.find((n) => n.key.endsWith(':s1440'))!.body).toBe('Morgen · 13:00');
  });

  it('repeats: soft "Noch offen" every 30 minutes up to the limit, only for reminders, none once answered', async () => {
    const e = await reminder();
    await eventRepo.create({
      title: 'Zahnarzt',
      allDay: false,
      startDate: '2026-10-05',
      startTime: '15:00',
      notify: { enabled: true, minutesBefore: 10 },
    } as never);
    const wide = { from: range.from, to: toEpoch('2026-10-06', '12:00') };
    const reps = async () => (await source(wide)).filter((n) => /:r\d+$/.test(n.key));
    expect(await reps()).toHaveLength(6); // the default limit; the appointment (Zahnarzt) has none
    const out = await reps();
    expect(out[0]).toMatchObject({
      key: `event:${e.id}:2026-10-05T13:00:r1`,
      at: toEpoch('2026-10-05', '13:20'),
      title: 'Noch offen: Paket abholen',
      soft: true,
    });
    expect(out[5]!.at).toBe(toEpoch('2026-10-05', '15:50'));
    expect(out[5]!.body).toMatch(/letzte Erinnerung/);
    await patchFocusSettings({ repeatMinutes: 10, repeatMax: 3 });
    expect((await reps()).map((n) => n.at)).toEqual([
      toEpoch('2026-10-05', '13:00'),
      toEpoch('2026-10-05', '13:10'),
      toEpoch('2026-10-05', '13:20'),
    ]);
    await ackNotification(`event:${e.id}:2026-10-05T13:00`);
    expect(await reps()).toHaveLength(0);
    await db.table('_settings').clear();
    await patchFocusSettings({ followUp: false });
    expect(await reps()).toHaveLength(0);
  });

  it('no staged extras by default', async () => {
    await reminder();
    expect((await keys()).every((k) => !/:s\d+$/.test(k))).toBe(true);
  });
});

describe('calendar notifications: the series over a day', () => {
  it('reminder 13:00, no reaction → 13:30, 14:00, …; "Erledigt" at 14:10 ends it, on all devices', async () => {
    const e = await reminder({ notify: { enabled: true, minutesBefore: 0 } });
    const key = `event:${e.id}:2026-10-05T13:00`;
    const at = (h: string) => toEpoch('2026-10-05', h);
    // The clock walks on: everything that fell due up to 14:10 …
    const until1410 = await source({ from: at('12:00'), to: at('14:10') });
    expect(until1410.map((n) => [n.key.slice(key.length), n.at])).toEqual([
      ['', at('13:00')],
      [':r1', at('13:30')],
      [':r2', at('14:00')],
    ]);
    // … the user answers (on another device: only the synced row arrives) …
    await db.table('_settings').put({
      id: 'reminders',
      createdAt: '2026-10-05T14:10:00.000Z',
      updatedAt: '2026-10-05T14:10:00.000Z',
      deviceId: 'phone',
      deletedAt: null,
      _f: {},
      acked: [key],
    });
    // … and nothing else follows, however long we wait.
    expect(await source({ from: at('14:10'), to: toEpoch('2026-10-06', '12:00') })).toEqual([]);
  });

  it('several reminders: answering one leaves the others repeating', async () => {
    const a = await reminder({ title: 'A', notify: { enabled: true, minutesBefore: 0 } });
    const b = await reminder({ title: 'B', notify: { enabled: true, minutesBefore: 0 } });
    await ackNotification(`event:${a.id}:2026-10-05T13:00`);
    const out = await source({
      from: toEpoch('2026-10-05', '13:00'),
      to: toEpoch('2026-10-05', '14:00'),
    });
    expect(out.map((n) => n.key)).toEqual([
      `event:${b.id}:2026-10-05T13:00:r1`,
      `event:${b.id}:2026-10-05T13:00:r2`,
    ]);
  });

  it('a daily recurring reminder repeats per occurrence; answering today leaves tomorrow alone', async () => {
    const e = await reminder({
      notify: { enabled: true, minutesBefore: 0 },
      recurrence: { freq: 'daily', interval: 1 },
    });
    await patchFocusSettings({ repeatMax: 3 });
    await ackNotification(`event:${e.id}:2026-10-05T13:00`);
    const out = await source({
      from: toEpoch('2026-10-05', '14:00'),
      to: toEpoch('2026-10-06', '14:30'),
    });
    expect(out.map((n) => n.key.replace(`event:${e.id}:`, ''))).toEqual([
      '2026-10-06T13:00',
      '2026-10-06T13:00:r1',
      '2026-10-06T13:00:r2',
      '2026-10-06T13:00:r3',
    ]);
  });
});
