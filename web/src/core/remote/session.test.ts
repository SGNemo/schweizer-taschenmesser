import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeRemoteParts } from '@/core/platform/fakeRemote';
import {
  ANSWER_WAIT_MS,
  createHoldGate,
  createRemoteSession,
  HOLD_STEPS_PER_SECOND,
  NO_ANSWER_GAP_MS,
  OPEN_EVERY_MS,
  type RemoteView,
  type SyncVerdict,
} from './session';

function rig(sync: SyncVerdict = 'ok') {
  const parts = createFakeRemoteParts();
  const verdict = { value: sync, rounds: 0 };
  const session = createRemoteSession({
    remote: parts.remote,
    syncRound: async () => {
      verdict.rounds += 1;
      return verdict.value;
    },
    now: () => Date.now(),
  });
  const seen: RemoteView['kind'][] = [];
  session.subscribe((v) => seen.push(v.kind));
  return { ...parts, session, verdict, seen };
}

/** Lets promises and fake timers run until `ms` have passed. */
const pass = (ms: number) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

describe('remote session: opening', () => {
  it('opens a media session and shows the PC’s state', async () => {
    const { session, seen } = rig();
    await session.open();
    expect(session.view()).toEqual({
      kind: 'connected',
      pc: { volume: 42, mute: false, playing: false, locked: false },
    });
    expect(seen).toEqual(['connecting', 'connected']);
  });

  it('never runs two opens at once and at most one a second', async () => {
    const { session, hooks } = rig();
    void session.open();
    void session.open();
    await pass(0);
    expect(hooks.opens()).toBe(1);
    await session.close();
    const again = session.open();
    await pass(OPEN_EVERY_MS - 1);
    expect(hooks.opens()).toBe(1);
    await pass(1);
    await again;
    expect(hooks.opens()).toBe(2);
  });

  it.each([
    ['remote-off'],
    ['not-granted'],
    ['busy'],
    ['paused'],
    ['locked'],
    ['unsupported'],
    ['ended'],
    ['limit'],
  ] as const)('a refusal "%s" is that state, without a sync round', async (reason) => {
    const { session, hooks, verdict } = rig();
    hooks.failOpen(reason);
    await session.open();
    expect(session.view()).toEqual({ kind: 'refused', reason });
    expect(verdict.rounds).toBe(0);
  });

  it('"not paired" from the phone’s own store is the first row', async () => {
    const { session, hooks } = rig();
    hooks.failOpen('not-paired');
    await session.open();
    expect(session.view().kind).toBe('not-paired');
  });

  it('an answer this version does not understand offers to try again', async () => {
    const { session, hooks } = rig();
    hooks.failOpen('protocol');
    await session.open();
    expect(session.view().kind).toBe('retry');
  });
});

describe('remote session: reading the PC’s silence', () => {
  it('"too old" only after two hang-ups a few seconds apart with a sync round that worked', async () => {
    const { session, hooks, verdict } = rig('ok');
    hooks.failOpen('no-answer', 2);
    const opening = session.open();
    await pass(0);
    // after the first hang-up nothing is decided yet
    expect(session.view().kind).toBe('connecting');
    expect(verdict.rounds).toBe(1);
    await pass(NO_ANSWER_GAP_MS - 1);
    expect(hooks.opens()).toBe(1);
    await pass(1);
    await opening;
    expect(hooks.opens()).toBe(2);
    expect(verdict.rounds).toBe(2);
    expect(session.view().kind).toBe('too-old');
  });

  it('one hang-up followed by an answer is simply connected (the PC shed load)', async () => {
    const { session, hooks } = rig('ok');
    hooks.failOpen('no-answer', 1);
    const opening = session.open();
    await pass(NO_ANSWER_GAP_MS);
    await opening;
    expect(session.view().kind).toBe('connected');
  });

  it('a hang-up while sync fails too is "not reachable", never "too old"', async () => {
    const { session, hooks } = rig('failed');
    hooks.failOpen('no-answer', 5);
    await session.open();
    expect(session.view().kind).toBe('unreachable');
    expect(hooks.opens()).toBe(1);
  });

  it('a network error tries once more after a sync round that worked (the PC moved), then gives up', async () => {
    const moved = rig('ok');
    moved.hooks.failOpen('network', 1);
    const opening = moved.session.open();
    await pass(OPEN_EVERY_MS);
    await opening;
    expect(moved.session.view().kind).toBe('connected');

    const gone = rig('ok');
    gone.hooks.failOpen('network', 9);
    const failing = gone.session.open();
    await pass(OPEN_EVERY_MS);
    await failing;
    expect(gone.session.view().kind).toBe('unreachable');
    expect(gone.hooks.opens()).toBe(2);

    const offline = rig('failed');
    offline.hooks.failOpen('network', 9);
    await offline.session.open();
    expect(offline.session.view().kind).toBe('unreachable');
    expect(offline.hooks.opens()).toBe(1);
  });

  it('"unknown device" never means unpaired by itself: only the sync round says so', async () => {
    const here = rig('ok');
    here.hooks.failOpen('unknown-device');
    await here.session.open();
    expect(here.session.view().kind).toBe('no-input-here');

    const unpaired = rig('not-paired');
    unpaired.hooks.failOpen('unknown-device');
    await unpaired.session.open();
    expect(unpaired.session.view().kind).toBe('not-paired');
  });

  it('whatever the PC did: a sync round that says "not paired" wins', async () => {
    for (const code of ['network', 'no-answer']) {
      const { session, hooks } = rig('not-paired');
      hooks.failOpen(code, 3);
      await session.open();
      expect(session.view().kind, code).toBe('not-paired');
    }
  });
});

describe('remote session: sending', () => {
  it('sends one action and takes the PC’s answer as the new state', async () => {
    const { session, hooks } = rig();
    await session.open();
    expect(await session.send('volume-up')).toBe(true);
    expect(hooks.sent()).toEqual(['volume-up']);
    expect(session.view()).toMatchObject({ kind: 'connected', pc: { volume: 44 } });
    expect(await session.send('play-pause')).toBe(true);
    expect(session.view()).toMatchObject({ pc: { playing: true } });
  });

  it('"louder" lifts a mute at the PC', async () => {
    const { session, hooks } = rig();
    hooks.setState({ mute: true });
    await session.open();
    await session.send('volume-up');
    expect(session.view()).toMatchObject({ pc: { mute: false } });
  });

  it('a change at the PC itself arrives unasked', async () => {
    const { session, hooks } = rig();
    await session.open();
    hooks.setState({ volume: 80 });
    expect(session.view()).toMatchObject({ pc: { volume: 80 } });
  });

  it('a PC that stops answering is "not connected" after a few seconds, and a touch opens again', async () => {
    const { session, hooks } = rig();
    await session.open();
    hooks.goSilent();
    await session.send('next');
    await pass(ANSWER_WAIT_MS - 1);
    expect(session.view().kind).toBe('connected');
    await pass(1);
    expect(session.view().kind).toBe('disconnected');
    expect(hooks.isOpen()).toBe(false);
    hooks.goSilent(false);
    const touch = session.send('next');
    await pass(OPEN_EVERY_MS);
    expect(await touch).toBe(true);
    expect(session.view().kind).toBe('connected');
  });

  it('an end without a reason is "not connected"; with a reason it is that state', async () => {
    const lost = rig();
    await lost.session.open();
    lost.hooks.close(null);
    expect(lost.session.view().kind).toBe('disconnected');

    const ended = rig();
    await ended.session.open();
    ended.hooks.close('ended');
    expect(ended.session.view()).toEqual({ kind: 'refused', reason: 'ended' });
  });

  it('nothing is sent in a refused or unreachable state (the keys stay with the phone)', async () => {
    const { session, hooks } = rig();
    hooks.failOpen('paused');
    await session.open();
    expect(await session.send('volume-up')).toBe(false);
    expect(hooks.sent()).toEqual([]);
    expect(hooks.opens()).toBe(1);
    expect(session.takesVolumeKeys()).toBe(false);
  });

  it('the volume keys belong to the PC while a session is open or just dropped', async () => {
    const { session, hooks } = rig();
    expect(session.takesVolumeKeys()).toBe(false);
    await session.open();
    expect(session.takesVolumeKeys()).toBe(true);
    hooks.close(null);
    expect(session.takesVolumeKeys()).toBe(true);
    await session.close();
    expect(session.takesVolumeKeys()).toBe(false);
  });

  it('a send error is never a state of its own', async () => {
    const { session, remote } = rig();
    await session.open();
    vi.spyOn(remote, 'send').mockRejectedValueOnce(new Error('network'));
    expect(await session.send('next')).toBe(false);
    expect(session.view().kind).toBe('disconnected');
  });
});

describe('remote session: leaving', () => {
  it('closing ends the session at the PC and drops late words', async () => {
    const { session, hooks } = rig();
    await session.open();
    await session.close();
    expect(hooks.isOpen()).toBe(false);
    expect(session.view().kind).toBe('idle');
    hooks.setState({ volume: 1 });
    expect(session.view().kind).toBe('idle');
  });

  it('leaving while it connects leaves no session behind', async () => {
    const { session, hooks } = rig('ok');
    hooks.failOpen('no-answer', 1);
    const opening = session.open();
    await pass(0);
    await session.close();
    await pass(NO_ANSWER_GAP_MS + OPEN_EVERY_MS);
    await opening;
    expect(session.view().kind).toBe('idle');
    expect(hooks.isOpen()).toBe(false);
    expect(hooks.opens()).toBe(1);
  });
});

describe('holding a volume key', () => {
  it('lets through at most five steps a second', () => {
    let t = 0;
    const gate = createHoldGate(() => t);
    let steps = 0;
    for (; t < 1000; t += 10) if (gate()) steps += 1;
    expect(steps).toBe(HOLD_STEPS_PER_SECOND);
  });
});
