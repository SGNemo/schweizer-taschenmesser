import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import type { DueNotification } from '@/core/modules/types';
import { DEFAULT_FOCUS, getFocusSettings, patchFocusSettings } from '@/core/settings/focus';
import { setNow } from '@/core/time/now';
import { isAcked } from './ack';

const due = vi.hoisted(() => ({ list: [] as DueNotification[] }));
vi.mock('./collect', () => ({
  collectDue: async ({ from, to }: { from: number; to: number }) =>
    due.list.filter((n) => n.at > from && n.at <= to),
}));
vi.mock('@/core/modules/activation', () => ({ loadModuleStates: async () => [] }));
vi.mock('@/core/modules/contributions', () => ({ activeManifests: () => [] }));

import {
  baseKey,
  loadOpen,
  markAllDone,
  markDone,
  nextOpen,
  pickOpen,
  randomOpen,
  snoozeOpen,
} from './center';
import { getSnoozed } from './snooze';

const HOUR = 3_600_000;
const NOW = new Date(2026, 9, 2, 12, 0).getTime();
const n = (key: string, at: number): DueNotification => ({ key, at, title: key });

beforeEach(async () => {
  setNow(() => NOW);
  due.list = [];
  await db.table('_settings').clear();
  await db.table('_meta').clear();
});

describe('open reminders', () => {
  it('base key strips staged and follow-up suffixes', () => {
    expect(baseKey('event:1:2026-10-02T10:00:s60')).toBe('event:1:2026-10-02T10:00');
    expect(baseKey('event:1:2026-10-02T10:00:f')).toBe('event:1:2026-10-02T10:00');
    expect(baseKey('snooze:abc@5')).toBe('snooze:abc@5');
  });

  it('is oldest first, one per base reminder (latest stage wins), minus answered ones', () => {
    const list = pickOpen([n('b', 30), n('a:s60', 10), n('a', 20), n('c', 5)], new Set(['c']));
    expect(list.map((x) => x.key)).toEqual(['a', 'b']);
    expect(nextOpen(list)?.key).toBe('a');
    expect(nextOpen([])).toBeUndefined();
  });

  it('random never repeats the previous one while there is a choice', () => {
    const list = [n('a', 1), n('b', 2), n('c', 3)];
    for (const r of [0, 0.34, 0.67, 0.99])
      expect(randomOpen(list, 'b', () => r)?.key).not.toBe('b');
    expect(randomOpen([n('a', 1)], 'a')?.key).toBe('a');
    expect(randomOpen([])).toBeUndefined();
  });

  it('loads what fell due in the last day and drops answered reminders', async () => {
    due.list = [
      n('old', NOW - 30 * HOUR),
      n('x', NOW - 2 * HOUR),
      n('y', NOW - HOUR),
      n('later', NOW + HOUR),
    ];
    expect((await loadOpen()).map((x) => x.key)).toEqual(['x', 'y']);
    await markDone(n('x:s60', 0));
    expect(await isAcked('x')).toBe(true);
    expect((await loadOpen()).map((x) => x.key)).toEqual(['y']);
    await markAllDone(await loadOpen());
    expect(await loadOpen()).toEqual([]);
  });

  it('"Später" creates a new reminder and removes the original from the open list', async () => {
    due.list = [n('x', NOW - HOUR)];
    await snoozeOpen(n('x', NOW - HOUR), '1h');
    expect(await loadOpen()).toEqual([]);
    const snoozed = await getSnoozed();
    expect(snoozed).toHaveLength(1);
    expect(snoozed[0]!.until).toBe(NOW + HOUR);
  });
});

describe('in-app card setting', () => {
  it('is off by default and keeps an explicit earlier choice', async () => {
    expect(DEFAULT_FOCUS.inAppPrompt).toBe(false);
    expect((await getFocusSettings()).inAppPrompt).toBe(false);
    await patchFocusSettings({ inAppPrompt: true });
    expect((await getFocusSettings()).inAppPrompt).toBe(true);
  });

  it('position and duration default to top and "until answered"', async () => {
    const s = await getFocusSettings();
    expect([s.inAppPosition, s.inAppSeconds]).toEqual(['top', 0]);
  });
});
