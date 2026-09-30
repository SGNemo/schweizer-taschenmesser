import { describe, expect, it, vi } from 'vitest';
import type { DueNotification } from '@/core/modules/types';
import {
  MAX_SCHEDULED,
  pickUpcoming,
  startNativeSchedule,
  syncNativeSchedule,
  type NativeScheduleDeps,
} from './nativeSchedule';
import { checkDue } from './scheduler';

const NOW = 1_000_000_000_000;
const due = (key: string, at: number): DueNotification => ({
  key,
  at,
  title: `T ${key}`,
  body: 'b',
  url: '/x',
});

function deps(over: Partial<NativeScheduleDeps['service']> = {}, list: DueNotification[] = []) {
  const scheduleUpcoming = vi.fn(async () => undefined);
  const d: NativeScheduleDeps = {
    service: { permission: () => 'granted', scheduleUpcoming, ...over },
    loadDue: vi.fn(async () => list),
    now: () => NOW,
  };
  return { d, scheduleUpcoming };
}

describe('pickUpcoming', () => {
  it('keeps future items once, earliest first', () => {
    const picked = pickUpcoming(
      [
        due('b', NOW + 20),
        due('a', NOW + 10),
        due('a', NOW + 15),
        due('past', NOW - 1),
        due('now', NOW),
      ],
      NOW,
    );
    expect(picked.map((p) => p.key)).toEqual(['a', 'b']);
    expect(picked[0]).toEqual({ key: 'a', at: NOW + 10, title: 'T a', body: 'b', url: '/x' });
  });

  it('caps the number of OS alarms at the earliest ones', () => {
    const many = Array.from({ length: MAX_SCHEDULED + 50 }, (_, i) => due(`k${i}`, NOW + 1000 - i));
    const picked = pickUpcoming(many, NOW);
    expect(picked).toHaveLength(MAX_SCHEDULED);
    expect(picked[0]!.at).toBeLessThan(picked.at(-1)!.at);
    expect(Math.max(...picked.map((p) => p.at))).toBeLessThan(NOW + 1000 - 49);
  });
});

describe('syncNativeSchedule', () => {
  it('replaces the OS schedule with the upcoming notifications of the next 14 days', async () => {
    const { d, scheduleUpcoming } = deps({}, [due('a', NOW + 5)]);
    expect(await syncNativeSchedule(d)).toBe(1);
    expect(d.loadDue).toHaveBeenCalledWith({ from: NOW, to: NOW + 14 * 24 * 3600_000 });
    expect(scheduleUpcoming).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'a', at: NOW + 5 }),
    ]);
  });

  it('clears the OS schedule when nothing is upcoming any more', async () => {
    const { d, scheduleUpcoming } = deps({}, []);
    expect(await syncNativeSchedule(d)).toBe(0);
    expect(scheduleUpcoming).toHaveBeenCalledWith([]);
  });

  it('does nothing without OS support or permission', async () => {
    const noSupport = deps({ scheduleUpcoming: undefined }, [due('a', NOW + 5)]);
    expect(await syncNativeSchedule(noSupport.d)).toBeUndefined();
    const denied = deps({ permission: () => 'denied' }, [due('a', NOW + 5)]);
    expect(await syncNativeSchedule(denied.d)).toBeUndefined();
    expect(denied.scheduleUpcoming).not.toHaveBeenCalled();
    expect(startNativeSchedule(noSupport.d)()).toBeUndefined(); // stop function is a no-op
  });
});

describe('in-app scheduler', () => {
  it('stays quiet when the OS fires notifications itself (no duplicates)', async () => {
    const show = vi.fn(async () => undefined);
    let cursor: number | undefined = NOW - 60_000;
    const shown = await checkDue({
      service: { permission: () => 'granted', show, scheduleUpcoming: async () => undefined },
      loadDue: async () => [due('a', NOW - 1000)],
      getCursor: async () => cursor,
      setCursor: async (at) => void (cursor = at),
      now: () => NOW,
    });
    expect(shown).toBe(0);
    expect(show).not.toHaveBeenCalled();
    expect(cursor).toBe(NOW); // the cursor still advances
  });
});
