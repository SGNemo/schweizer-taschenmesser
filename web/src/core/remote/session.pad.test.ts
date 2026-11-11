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

/** Lets promises and fake timers run until `ms` have passed. */
const pass = (ms: number) => vi.advanceTimersByTimeAsync(ms);
/** Runs `work` to its end while the clock moves (an open waits about a second for the one before). */
async function done(work: Promise<unknown>) {
  await pass(3 * OPEN_EVERY_MS);
  await work;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

describe('remote session: the mouse level', () => {
  it('Medien never asks for it; the touchpad opens it in place of the media session', async () => {
    const { session, hooks } = rig();
    hooks.setGrant('full');
    await session.open();
    expect(hooks.level()).toBe('media');
    expect(session.pad()).toEqual({ kind: 'off' });
    await done(session.raise('de'));
    expect(session.pad()).toEqual({ kind: 'ready', noLock: false });
    expect(hooks.level()).toBe('full');
    expect(session.view().kind).toBe('connected');
    // a mouse session carries Medien too
    expect(await session.send('volume-up')).toBe(true);
    // asked for once: a second use opens nothing
    const opens = hooks.opens();
    await done(session.raise('de'));
    expect(hooks.opens()).toBe(opens);
  });

  it('a phone granted only media gets its sentence at once: no call, no prompt', async () => {
    const { session, hooks } = rig();
    hooks.setGrant('media', true);
    await session.open();
    await session.raise('de');
    expect(session.pad()).toEqual({ kind: 'not-granted' });
    expect(hooks.opens()).toBe(1);
    expect(hooks.unlocks()).toBe(0);
    // nothing of the pad goes out
    session.point('move', 5, 5);
    session.click(['left-down', 'left-up']);
    await pass(0);
    expect(hooks.pointed()).toEqual([]);
    expect(hooks.sent()).toEqual([]);
  });

  it('a grant lowered at the PC meanwhile comes back as a media session', async () => {
    const { session, hooks } = rig();
    hooks.setGrant('full');
    await session.open();
    hooks.setGrant('media');
    await done(session.raise('de'));
    expect(session.pad()).toEqual({ kind: 'not-granted' });
    expect(session.view().kind).toBe('connected');
    expect(await session.send('mute')).toBe(true);
  });

  it('a locked PC is not even asked; once it is unlocked the next use opens', async () => {
    const { session, hooks } = rig();
    hooks.setGrant('full', true);
    await session.open();
    hooks.setState({ locked: true });
    await session.raise('de');
    expect(session.pad()).toEqual({ kind: 'locked' });
    expect(hooks.opens()).toBe(1);
    expect(hooks.unlocks()).toBe(0);
    hooks.setState({ locked: false });
    await done(session.raise('de'));
    expect(session.pad().kind).toBe('ready');
  });

  it('a dismissed unlock keeps Medien and is asked again only by the person’s own step', async () => {
    const { session, hooks } = rig();
    hooks.setGrant('full', true);
    hooks.setUnlock('cancel');
    await session.open();
    await done(session.raise('de'));
    expect(session.pad()).toEqual({ kind: 'unlock' });
    expect(hooks.level()).toBe('media');
    expect(await session.send('mute')).toBe(true);
    // the page comes back to the pad, the session reconnects: no prompt by itself
    await done(session.raise('de'));
    hooks.close();
    await done(session.open());
    await done(session.raise('de'));
    expect(hooks.unlocks()).toBe(1);
    expect(session.pad()).toEqual({ kind: 'unlock' });
    hooks.setUnlock('ok');
    await done(session.raise('de', { again: true }));
    expect(hooks.unlocks()).toBe(2);
    expect(session.pad()).toEqual({ kind: 'ready', noLock: false });
  });

  it('a phone without a screen lock is not blocked and says so; one that cannot ask is told', async () => {
    const a = rig();
    a.hooks.setGrant('full', true);
    a.hooks.setUnlock('none');
    await a.session.open();
    await done(a.session.raise('de'));
    expect(a.session.pad()).toEqual({ kind: 'ready', noLock: true });

    const b = rig();
    b.hooks.setGrant('full', true);
    b.hooks.setUnlock('unavailable');
    await b.session.open();
    await done(b.session.raise('de'));
    expect(b.session.pad()).toEqual({ kind: 'unavailable' });
    expect(b.hooks.level()).toBe('media');
  });

  it('after unlock-needed it starts from Medien and tries once more', async () => {
    const { session, hooks } = rig();
    hooks.setGrant('full');
    await session.open();
    hooks.failOpen('unlock-needed');
    await done(session.raise('de'));
    // media again, then the mouse level: three opens after the first
    expect(session.pad()).toEqual({ kind: 'ready', noLock: false });
    expect(hooks.level()).toBe('full');
  });

  it('a refusal of the PC is told in the session’s own words', async () => {
    const { session, hooks } = rig();
    hooks.setGrant('full');
    await session.open();
    hooks.setGrant('off');
    await done(session.raise('de'));
    expect(session.pad()).toEqual({ kind: 'off' });
    expect(session.view()).toEqual({ kind: 'refused', reason: 'not-granted' });
  });

  it('the session ending takes the level with it', async () => {
    const { session, hooks } = rig();
    hooks.setGrant('full');
    await session.open();
    await done(session.raise('de'));
    hooks.close();
    expect(session.pad()).toEqual({ kind: 'off' });
    expect(session.view().kind).toBe('disconnected');
    session.point('move', 3, 3);
    await pass(0);
    expect(hooks.pointed()).toEqual([]);
  });
});

describe('remote session: what the pad sends', () => {
  async function ready() {
    const r = rig();
    r.hooks.setGrant('full');
    await r.session.open();
    await done(r.session.raise('de'));
    return r;
  }

  it('sends every move at once and sums only while a write is pending', async () => {
    const { session, hooks, remote } = await ready();
    session.point('move', 2, 1);
    await pass(0);
    expect(hooks.pointed()).toEqual([{ kind: 'move', dx: 2, dy: 1 }]);
    // a slow write: what arrives meanwhile becomes one move
    let release: () => void = () => undefined;
    const pointer = remote.pointer.bind(remote);
    const slow = vi.spyOn(remote, 'pointer').mockImplementationOnce(async (...args) => {
      await new Promise<void>((resolve) => (release = resolve));
      return pointer(...args);
    });
    session.point('move', 1, 0);
    session.point('move', 4, 4);
    session.point('move', -1, 2);
    await pass(0);
    release();
    await pass(0);
    expect(hooks.pointed().slice(1)).toEqual([
      { kind: 'move', dx: 1, dy: 0 },
      { kind: 'move', dx: 3, dy: 6 },
    ]);
    slow.mockRestore();
  });

  it('keeps the order of moves, buttons and wheel steps', async () => {
    const { session, hooks, remote } = await ready();
    const order: string[] = [];
    const send = remote.send.bind(remote);
    const pointer = remote.pointer.bind(remote);
    vi.spyOn(remote, 'send').mockImplementation(async (id, actions) => {
      order.push(actions.join('+'));
      return send(id, actions);
    });
    vi.spyOn(remote, 'pointer').mockImplementation(async (id, kind, dx, dy) => {
      order.push(`${kind}:${dx},${dy}`);
      return pointer(id, kind, dx, dy);
    });
    session.click(['left-down']);
    session.point('move', 5, 0);
    session.point('move', 5, 0);
    session.click(['left-up']);
    session.point('scroll', 0, 2);
    await pass(0);
    expect(order).toEqual(['left-down', 'move:10,0', 'left-up', 'scroll:0,2']);
    expect(hooks.sent()).toEqual(['left-down', 'left-up']);
  });

  it('on a locked PC nothing moves and nothing is pressed; a release still goes', async () => {
    const { session, hooks } = await ready();
    session.click(['left-down']);
    await pass(0);
    hooks.setState({ locked: true });
    session.point('move', 9, 9);
    session.click(['right-down', 'right-up']);
    session.click(['left-up']);
    await pass(0);
    expect(hooks.pointed()).toEqual([]);
    expect(hooks.sent()).toEqual(['left-down', 'right-up', 'left-up']);
  });

  it('a write that fails ends the session: the next touch opens again', async () => {
    const { session, hooks, remote } = await ready();
    vi.spyOn(remote, 'pointer').mockRejectedValueOnce(new Error('closed'));
    session.point('move', 1, 1);
    session.point('move', 1, 1);
    await pass(0);
    expect(session.view().kind).toBe('disconnected');
    expect(session.pad()).toEqual({ kind: 'off' });
    expect(hooks.pointed()).toEqual([]);
  });

  it('leaving the page ends the level and empties the queue', async () => {
    const { session, hooks } = await ready();
    await session.close();
    expect(session.pad()).toEqual({ kind: 'off' });
    session.point('move', 1, 1);
    await pass(0);
    expect(hooks.pointed()).toEqual([]);
    expect(hooks.isOpen()).toBe(false);
  });
});
