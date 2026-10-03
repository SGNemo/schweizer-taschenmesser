import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import {
  getSnoozed,
  removeSnoozed,
  snoozedDue,
  snoozeNotification,
  snoozeOptions,
  snoozeUntil,
} from './snooze';

const at = (h: number, m = 0, day = 2) => new Date(2026, 9, day, h, m).getTime();

beforeEach(async () => {
  await db.table('_settings').clear();
});

describe('snooze options', () => {
  it('computes the end of each option on the local clock', () => {
    expect(snoozeUntil('10min', at(10))).toBe(at(10, 10));
    expect(snoozeUntil('1h', at(10, 30))).toBe(at(11, 30));
    expect(snoozeUntil('evening', at(10))).toBe(at(18));
    expect(snoozeUntil('tomorrow', at(22))).toBe(at(9, 0, 3));
    expect(snoozeUntil('pc', at(10))).toBe(at(10));
  });

  it('offers only what makes sense: no evening late in the day, "Am PC" only away from the desktop', () => {
    expect(snoozeOptions(at(10), 'android')).toEqual(['10min', '1h', 'evening', 'tomorrow', 'pc']);
    expect(snoozeOptions(at(10), 'desktop')).toEqual(['10min', '1h', 'evening', 'tomorrow']);
    expect(snoozeOptions(at(17, 30), 'web')).toEqual(['10min', '1h', 'tomorrow', 'pc']);
  });
});

describe('snoozed notifications', () => {
  it('fire in (from, to]; "Am PC" entries only on the desktop app, at the next check', () => {
    const entries = [
      { id: 'a', until: at(12), title: 'A' },
      { id: 'p', until: at(9), title: 'P', desktopOnly: true },
    ];
    const range = { from: at(11), to: at(13) };
    expect(snoozedDue(entries, range, 'web').map((n) => n.key)).toEqual(['snooze:a']);
    expect(snoozedDue(entries, range, 'desktop').map((n) => [n.key, n.at])).toEqual([
      ['snooze:a', at(12)],
      ['snooze:p', at(13)],
    ]);
    expect(snoozedDue(entries, { from: at(13), to: at(14) }, 'web')).toEqual([]);
  });

  it('are stored in synced settings and removed once shown', async () => {
    const e = await snoozeNotification(
      { key: 'event:1:x', title: 'Paket', url: '/calendar' },
      '1h',
      at(10),
    );
    expect(e).toMatchObject({ id: `event:1:x@${at(11)}`, until: at(11), title: 'Paket' });
    expect(await getSnoozed()).toHaveLength(1);
    await snoozeNotification({ key: 'event:1:x', title: 'Paket' }, '1h', at(10)); // same again: one entry
    expect(await getSnoozed()).toHaveLength(1);
    await removeSnoozed(`snooze:${e.id}`);
    expect(await getSnoozed()).toEqual([]);
  });

  it('drops entries that are more than a day old when something new is added', async () => {
    await snoozeNotification({ key: 'old', title: 'Alt' }, '10min', at(10, 0, 1));
    await snoozeNotification({ key: 'new', title: 'Neu' }, '10min', at(10, 0, 3));
    expect((await getSnoozed()).map((e) => e.title)).toEqual(['Neu']);
  });
});
