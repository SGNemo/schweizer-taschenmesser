import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeRemoteParts } from '@/core/platform/fakeRemote';
import { OPEN_EVERY_MS, createRemoteSession } from './session';

function rig() {
  const parts = createFakeRemoteParts();
  const session = createRemoteSession({
    remote: parts.remote,
    syncRound: async () => 'ok',
    now: () => Date.now(),
  });
  return { ...parts, session };
}
const pass = (ms: number) => vi.advanceTimersByTimeAsync(ms);
async function done<T>(work: Promise<T>): Promise<T> {
  await pass(3 * OPEN_EVERY_MS);
  return work;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

describe('remote session: presentation', () => {
  it('knows whether the PC takes the presentation keys from its answer to open', async () => {
    const { session, hooks } = rig();
    expect(session.present()).toBe(false);
    await session.open();
    expect(session.present()).toBe(true);
    // a dropped connection keeps what the PC said; the next answer replaces it
    hooks.close();
    expect(session.present()).toBe(true);
    hooks.setPresent(false);
    await done(session.open());
    expect(session.present()).toBe(false);
  });

  it('sends F5 and B on the mouse level, like any key', async () => {
    const { session, hooks } = rig();
    hooks.setGrant('full');
    await session.open();
    // not on a media session
    expect(session.key('key-f5')).toBe(false);
    await done(session.raise('de'));
    expect(session.key('key-f5')).toBe(true);
    expect(session.key('key-b')).toBe(true);
    expect(session.key('key-right')).toBe(true);
    await pass(0);
    expect(hooks.sent()).toEqual(['key-f5', 'key-b', 'key-right']);
    // a locked PC takes no key
    hooks.setState({ locked: true });
    expect(session.key('key-b')).toBe(false);
  });

  it('never sends a presentation key to a PC that did not say it takes them', async () => {
    const { session, hooks } = rig();
    hooks.setGrant('full');
    hooks.setPresent(false);
    await session.open();
    await done(session.raise('de'));
    expect(session.pad().kind).toBe('ready');
    expect(session.key('key-f5')).toBe(false);
    expect(session.key('key-b')).toBe(false);
    // the other keys still go, and the session stands
    expect(session.key('key-left')).toBe(true);
    await pass(0);
    expect(hooks.sent()).toEqual(['key-left']);
    expect(session.view().kind).toBe('connected');
  });
});
