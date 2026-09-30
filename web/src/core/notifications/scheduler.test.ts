import { describe, expect, it, vi } from 'vitest';
import type { DueNotification } from '@/core/modules/types';
import { checkDue, MAX_CATCH_UP_MS, type SchedulerDeps } from './scheduler';

function setup(opts: {
  cursor?: number;
  now: number;
  permission?: 'granted' | 'denied';
  due?: DueNotification[];
}) {
  let cursor = opts.cursor;
  const show = vi.fn().mockResolvedValue(undefined);
  const loadDue = vi.fn(async ({ from, to }: { from: number; to: number }) =>
    (opts.due ?? []).filter((n) => n.at > from && n.at <= to),
  );
  const deps: SchedulerDeps = {
    service: { permission: () => opts.permission ?? 'granted', show },
    loadDue,
    getCursor: async () => cursor,
    setCursor: async (c) => void (cursor = c),
    now: () => opts.now,
  };
  return { deps, show, loadDue, cursor: () => cursor };
}

const n = (key: string, at: number): DueNotification => ({ key, at, title: key });

describe('notification scheduler', () => {
  it('first run only sets the cursor', async () => {
    const s = setup({ now: 1000, due: [n('a', 500)] });
    expect(await checkDue(s.deps)).toBe(0);
    expect(s.cursor()).toBe(1000);
    expect(s.show).not.toHaveBeenCalled();
  });

  it('fires items in (cursor, now] once and advances the cursor', async () => {
    const due = [n('old', 100), n('a', 1500), n('b', 1800), n('future', 5000)];
    const s = setup({ cursor: 1000, now: 2000, due });
    expect(await checkDue(s.deps)).toBe(2);
    expect(s.show.mock.calls.map((c) => c[0].tag)).toEqual(['a', 'b']);
    // Second check right after: window is empty, nothing fires again.
    s.deps.now = () => 2000;
    expect(await checkDue(s.deps)).toBe(0);
    expect(s.show).toHaveBeenCalledTimes(2);
  });

  it('does not show anything without permission but still advances the cursor', async () => {
    const s = setup({ cursor: 1000, now: 2000, permission: 'denied', due: [n('a', 1500)] });
    expect(await checkDue(s.deps)).toBe(0);
    expect(s.cursor()).toBe(2000);
  });

  it('limits catch-up to 24 hours', async () => {
    const now = 10 * MAX_CATCH_UP_MS;
    const s = setup({ cursor: 1000, now, due: [n('ancient', 5000), n('recent', now - 1000)] });
    await checkDue(s.deps);
    expect(s.show.mock.calls.map((c) => c[0].tag)).toEqual(['recent']);
  });

  it('deduplicates equal keys and survives a failing show()', async () => {
    const s = setup({ cursor: 0, now: 100, due: [n('x', 10), n('x', 20), n('y', 30)] });
    s.show.mockRejectedValueOnce(new Error('nope'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await checkDue(s.deps)).toBe(1);
    expect(s.show).toHaveBeenCalledTimes(2);
    err.mockRestore();
  });
});
