import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeRemoteParts } from '@/core/platform/fakeRemote';
import {
  ANSWER_WAIT_MS,
  KEYS_LINGER_MS,
  OPEN_PATIENCE_MS,
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
    hooks.goSilent(false);
    const touch = session.send('next');
    await pass(OPEN_EVERY_MS);
    expect(await touch).toBe(true);
    expect(session.view().kind).toBe('connected');
    expect(hooks.opens()).toBe(2);
  });

  it('an answer that arrives in time keeps a working session (the timer starts before the call)', async () => {
    const { session } = rig();
    await session.open();
    expect(await session.send('next')).toBe(true);
    await pass(ANSWER_WAIT_MS * 3);
    expect(session.view().kind).toBe('connected');
  });

  it('a late answer heals a session that had gone quiet, without a new connection', async () => {
    const { session, hooks } = rig();
    await session.open();
    hooks.goSilent();
    await session.send('play-pause');
    await pass(ANSWER_WAIT_MS);
    expect(session.view().kind).toBe('disconnected');
    // the PC did carry it out; only its word was late
    hooks.goSilent(false);
    hooks.setState({});
    expect(session.view()).toMatchObject({ kind: 'connected', pc: { playing: true } });
    expect(hooks.opens()).toBe(1);
    expect(await session.send('next')).toBe(true);
    expect(hooks.opens()).toBe(1);
  });

  it('while it connects only the last press waits: held keys never pile up', async () => {
    const { session, hooks } = rig();
    const release = hooks.holdOpens();
    const presses = [
      session.send('volume-up'),
      session.send('volume-up'),
      session.send('volume-up'),
      session.send('play-pause'),
    ];
    await pass(0);
    release();
    expect(await Promise.all(presses)).toEqual([false, false, false, true]);
    expect(hooks.sent()).toEqual(['play-pause']);
    expect(hooks.opens()).toBe(1);
  });

  it('a key repeat never opens a connection', async () => {
    const { session, hooks } = rig();
    await session.open();
    hooks.close(null);
    expect(await session.send('volume-up', { repeat: true })).toBe(false);
    expect(hooks.opens()).toBe(1);
    // a fresh press does
    const press = session.send('volume-up');
    await pass(OPEN_EVERY_MS);
    expect(await press).toBe(true);
    expect(hooks.opens()).toBe(2);
    // and once it stands, repeats go through
    expect(await session.send('volume-up', { repeat: true })).toBe(true);
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

  it('the volume keys belong to the PC while a session is open, and only briefly after it dropped', async () => {
    const { session, hooks } = rig();
    expect(session.takesVolumeKeys()).toBe(false);
    await session.open();
    expect(session.takesVolumeKeys()).toBe(true);
    hooks.close(null);
    expect(session.takesVolumeKeys()).toBe(true);
    await pass(KEYS_LINGER_MS);
    expect(session.takesVolumeKeys()).toBe(false);
    await session.close();
    expect(session.takesVolumeKeys()).toBe(false);
  });

  it('a first connect never takes the phone’s volume keys', async () => {
    const { session, hooks } = rig();
    const release = hooks.holdOpens();
    const opening = session.open();
    await pass(0);
    expect(session.view().kind).toBe('connecting');
    expect(session.takesVolumeKeys()).toBe(false);
    release();
    await opening;
    expect(session.takesVolumeKeys()).toBe(true);
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

describe('remote session: patience and races', () => {
  it('"connecting" is shown for a few seconds at most, then "not reachable" while it keeps trying', async () => {
    const { session, hooks } = rig();
    const release = hooks.holdOpens();
    const opening = session.open();
    await pass(OPEN_PATIENCE_MS - 1);
    expect(session.view().kind).toBe('connecting');
    await pass(1);
    expect(session.view().kind).toBe('unreachable');
    // "Erneut versuchen" joins the attempt that is still running
    void session.open();
    expect(hooks.opens()).toBe(1);
    release();
    await opening;
    expect(session.view().kind).toBe('connected');
  });

  it('leaving while the PC is being dialled, then coming back, connects afresh', async () => {
    const { session, hooks } = rig();
    const release = hooks.holdOpens();
    const first = session.open();
    await pass(0);
    await session.close();
    expect(session.view().kind).toBe('idle');
    const second = session.open();
    release();
    await pass(OPEN_EVERY_MS);
    await Promise.all([first, second]);
    expect(session.view().kind).toBe('connected');
    expect(hooks.isOpen()).toBe(true);
    // the first attempt left nothing behind and the press after coming back works
    expect(await session.send('next')).toBe(true);
  });

  it('leaving during the wait between two tries dials nothing more', async () => {
    const { session, hooks } = rig('ok');
    hooks.failOpen('no-answer', 1);
    const opening = session.open();
    await pass(0);
    await session.close();
    await pass(NO_ANSWER_GAP_MS + OPEN_EVERY_MS);
    await opening;
    expect(hooks.opens()).toBe(1);
    expect(session.view().kind).toBe('idle');
  });

  it('an open overtaken by a newer one of this device is "not connected", not "connecting" forever', async () => {
    const { session, hooks } = rig();
    hooks.failOpen('closed');
    await session.open();
    expect(session.view().kind).toBe('disconnected');
    expect(session.takesVolumeKeys()).toBe(false);
  });

  it('what the PC says before the answer to "open" arrives is not lost', async () => {
    const { session, hooks } = rig();
    hooks.endRightAfterOpen('paused');
    await session.open();
    expect(session.view()).toEqual({ kind: 'refused', reason: 'paused' });
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
