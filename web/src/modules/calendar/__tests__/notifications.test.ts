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
    await patchFocusSettings({ staggered: true, stages: [1440, 60, 10] });
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

  it('follow-up: once, only for reminders, soft, 30 minutes later, not after "Erledigt"', async () => {
    const e = await reminder();
    await eventRepo.create({
      title: 'Zahnarzt',
      allDay: false,
      startDate: '2026-10-05',
      startTime: '15:00',
      notify: { enabled: true, minutesBefore: 10 },
    } as never);
    await patchFocusSettings({ followUp: true });
    const out = await source(range);
    const follow = out.filter((n) => n.key.endsWith(':f'));
    expect(follow).toHaveLength(1);
    expect(follow[0]).toMatchObject({
      at: toEpoch('2026-10-05', '13:20'),
      title: 'Noch aktuell? Paket abholen',
      soft: true,
    });
    await ackNotification(`event:${e.id}:2026-10-05T13:00`);
    expect((await keys()).filter((k) => k.endsWith(':f'))).toHaveLength(0);
  });

  it('nothing extra by default', async () => {
    await reminder();
    expect((await keys()).every((k) => !/:(s|f)\d*$/.test(k))).toBe(true);
  });
});
