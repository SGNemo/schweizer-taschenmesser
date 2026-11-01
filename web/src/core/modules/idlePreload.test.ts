import { describe, expect, it, vi } from 'vitest';
import { preloadWhenIdle, type IdleScheduler } from './idlePreload';

/** A scheduler that runs nothing until the test says so. */
function manual() {
  const queue: (() => void)[] = [];
  let cancelled = false;
  const s: IdleScheduler = {
    idle: (run) => {
      queue.push(() => !cancelled && run());
      return () => {
        cancelled = true;
      };
    },
  };
  return { s, run: () => queue.shift()?.() };
}

describe('preloadWhenIdle', () => {
  it('nothing loads during the render; the idle slot starts every part', async () => {
    const { s, run } = manual();
    const a = vi.fn(async () => undefined);
    const b = vi.fn(async () => undefined);
    const done = vi.fn();
    preloadWhenIdle([a, b], s, done);
    expect(a).not.toHaveBeenCalled();
    run();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(done).toHaveBeenCalled());
  });

  it('a failing part (offline) does not stop the others and throws nowhere', async () => {
    const { s, run } = manual();
    const b = vi.fn(async () => undefined);
    const done = vi.fn();
    preloadWhenIdle([() => Promise.reject(new Error('offline')), b], s, done);
    run();
    await vi.waitFor(() => expect(done).toHaveBeenCalled());
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('cancel before the idle slot: nothing loads', () => {
    const { s, run } = manual();
    const a = vi.fn(async () => undefined);
    const cancel = preloadWhenIdle([a], s);
    cancel();
    run();
    expect(a).not.toHaveBeenCalled();
  });
});
