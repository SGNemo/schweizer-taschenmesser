import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeRemoteParts } from '@/core/platform/fakeRemote';
import { createRemoteSession, type SyncVerdict } from './session';

function rig(sync: SyncVerdict = 'ok') {
  const parts = createFakeRemoteParts();
  const session = createRemoteSession({
    remote: parts.remote,
    syncRound: async () => sync,
    now: () => Date.now(),
  });
  return { ...parts, session };
}
const GRANTED = { granted: true, pending: false, hibernate: false };

/** Lets promises and fake timers run until `ms` have passed. */
const pass = (ms: number) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

describe('remote session: power', () => {
  it('knows what the PC says about power when it opens; an older PC has none', async () => {
    const { session, hooks } = rig();
    expect(session.power()).toEqual({ info: null, phase: { kind: 'idle' } });
    hooks.setPower({ granted: true, pending: false, hibernate: true });
    await session.open();
    expect(session.power().info).toEqual({ granted: true, pending: false, hibernate: true });
    await session.close();
    hooks.setPower(null);
    await pass(1000);
    await session.open();
    expect(session.power().info).toBeNull();
  });

  it('a power answer does not end the session; the countdown, then done', async () => {
    const { session, hooks } = rig();
    hooks.setPower(GRANTED);
    await session.open();
    await session.powerAct('shut-down', false, 'de');
    await pass(0);
    expect(session.view().kind).toBe('connected');
    expect(session.power().phase).toEqual({ kind: 'counting', action: 'shut-down' });
    expect(hooks.powered()).toEqual([{ action: 'shut-down', despite: false }]);
    expect(hooks.unlocks()).toBe(1);
    hooks.pushPower('done');
    await pass(0);
    expect(session.view().kind).toBe('connected');
    expect(session.power().phase).toEqual({ kind: 'done', action: 'shut-down' });
    // the PC goes away: expected, the done line stays
    hooks.close(null);
    expect(session.view().kind).toBe('disconnected');
    expect(session.power().phase.kind).toBe('done');
    await session.close();
    expect(session.power().phase.kind).toBe('done');
    // a new session stands: the PC is back, the line is over
    await pass(1000);
    await session.open();
    expect(session.power().phase.kind).toBe('idle');
  });

  it('the connection dropping during the countdown is done: the PC acts without the phone', async () => {
    const { session, hooks } = rig();
    hooks.setPower(GRANTED);
    await session.open();
    await session.powerAct('restart');
    await pass(0);
    expect(session.power().phase.kind).toBe('counting');
    hooks.close(null);
    expect(session.power().phase).toEqual({ kind: 'done', action: 'restart' });
    // back while it still counts: the countdown keeps its words
    await pass(1000);
    await session.open();
    expect(session.power().phase).toEqual({ kind: 'counting', action: 'restart' });
  });

  it('other states end with the session', async () => {
    const { session, hooks } = rig();
    hooks.setPower(GRANTED);
    hooks.setPowerBusy();
    await session.open();
    await session.powerAct('restart');
    await pass(0);
    expect(session.power().phase.kind).toBe('working');
    hooks.close(null);
    expect(session.power().phase.kind).toBe('idle');
  });

  it('a phone without a screen lock: the native confirm, dismissed, sends nothing', async () => {
    const { session, hooks } = rig();
    hooks.setPower(GRANTED);
    hooks.setUnlock('none');
    hooks.setConfirm('cancel');
    await session.open();
    await session.powerAct('shut-down');
    expect(hooks.confirms()).toBe(1);
    expect(hooks.powered()).toEqual([]);
    expect(session.power().phase).toEqual({ kind: 'unlock' });
  });

  it('"Abbrechen" is not held back by a prompt that is up', async () => {
    const { session, hooks } = rig();
    hooks.setPower(GRANTED);
    await session.open();
    // the start is still on its way (its prompt up) when "Abbrechen" comes
    const start = session.powerAct('shut-down');
    expect(session.power().phase.kind).toBe('asking');
    const cancel = session.powerAct('cancel');
    // a second start is held back
    await session.powerAct('restart');
    await Promise.all([start, cancel]);
    await pass(0);
    expect(hooks.powered().map((p) => p.action)).toEqual(['shut-down', 'cancel']);
  });

  it('"Abbrechen" while it counts: cancelled, the PC stays on', async () => {
    const { session, hooks } = rig();
    hooks.setPower(GRANTED);
    await session.open();
    await session.powerAct('sleep');
    await pass(0);
    await session.powerAct('cancel');
    await pass(0);
    expect(session.power().phase).toEqual({ kind: 'cancelled' });
    // cancel asks for no unlock
    expect(hooks.unlocks()).toBe(1);
    session.powerDismiss();
    expect(session.power().phase.kind).toBe('idle');
  });

  it('busy at the PC: working, then the same action despite it – no second prompt', async () => {
    const { session, hooks } = rig();
    hooks.setPower(GRANTED);
    hooks.setPowerBusy();
    await session.open();
    await session.powerAct('hibernate');
    await pass(0);
    expect(session.power().phase).toEqual({ kind: 'working', action: 'hibernate' });
    await session.powerAct('hibernate', true);
    await pass(0);
    expect(session.power().phase).toEqual({ kind: 'counting', action: 'hibernate' });
    expect(hooks.powered()).toEqual([
      { action: 'hibernate', despite: false },
      { action: 'hibernate', despite: true },
    ]);
    expect(hooks.unlocks()).toBe(1);
  });

  it('"Warten" after working goes back to idle without sending', async () => {
    const { session, hooks } = rig();
    hooks.setPower(GRANTED);
    hooks.setPowerBusy();
    await session.open();
    await session.powerAct('shut-down');
    await pass(0);
    session.powerDismiss();
    expect(session.power().phase.kind).toBe('idle');
    expect(hooks.powered()).toHaveLength(1);
  });

  it('refusals: not granted (the grant is gone), locked, limit, failed', async () => {
    const { session, hooks } = rig();
    hooks.setPower({ ...GRANTED, granted: false });
    await session.open();
    await session.powerAct('shut-down');
    await pass(0);
    expect(session.power().phase).toEqual({ kind: 'refused', reason: 'not-granted' });
    expect(session.power().info?.granted).toBe(false);

    hooks.setPower(GRANTED);
    await session.close();
    await pass(1000);
    await session.open();
    hooks.setState({ locked: true });
    await session.powerAct('shut-down');
    await pass(0);
    expect(session.power().phase).toEqual({ kind: 'refused', reason: 'locked' });
    for (const answer of ['limit', 'failed'] as const) {
      hooks.pushPower(answer);
      await pass(0);
      expect(session.power().phase).toEqual({ kind: 'refused', reason: answer });
    }
    expect(session.view().kind).toBe('connected');
  });

  it('a dismissed unlock sends nothing and is not asked again by itself', async () => {
    const { session, hooks } = rig();
    hooks.setPower(GRANTED);
    hooks.setUnlock('cancel');
    await session.open();
    await session.powerAct('shut-down');
    await pass(0);
    expect(session.power().phase).toEqual({ kind: 'unlock' });
    expect(hooks.powered()).toEqual([]);
    await pass(10_000);
    expect(hooks.unlocks()).toBe(1);
  });

  it('a phone that cannot ask for its lock says so', async () => {
    const { session, hooks } = rig();
    hooks.setPower(GRANTED);
    hooks.setUnlock('unavailable');
    await session.open();
    await session.powerAct('shut-down');
    expect(session.power().phase).toEqual({ kind: 'refused', reason: 'unavailable' });
  });

  it('without a session it opens one first, once', async () => {
    const { session, hooks } = rig();
    hooks.setPower(GRANTED);
    await session.powerAct('shut-down');
    await pass(0);
    expect(hooks.opens()).toBe(1);
    expect(session.power().phase.kind).toBe('counting');
  });

  it('a failed open is not repeated: nothing goes out, the page says why', async () => {
    const { session, hooks } = rig('failed');
    hooks.setPower(GRANTED);
    hooks.failOpen('network', 5);
    await session.powerAct('shut-down');
    await pass(10_000);
    expect(session.view().kind).toBe('unreachable');
    expect(session.power().phase.kind).toBe('idle');
    expect(hooks.powered()).toEqual([]);
    const opens = hooks.opens();
    await pass(10_000);
    expect(hooks.opens()).toBe(opens);
  });

  it('a PC from before power: no power action and no "monitor off" goes out', async () => {
    const { session, hooks } = rig();
    hooks.setPower(null);
    await session.open();
    await session.powerAct('shut-down');
    expect(hooks.powered()).toEqual([]);
    expect(session.power().phase.kind).toBe('idle');
    expect(await session.send('monitor-off')).toBe(false);
    expect(hooks.sent()).toEqual([]);
    expect(hooks.isOpen()).toBe(true);
  });

  it('"monitor off" goes to a PC that knows power', async () => {
    const { session, hooks } = rig();
    await session.open();
    expect(await session.send('monitor-off')).toBe(true);
    expect(hooks.sent()).toEqual(['monitor-off']);
    expect(session.view().kind).toBe('connected');
  });

  it('a countdown that runs at the PC already is shown when the session opens', async () => {
    const { session, hooks } = rig();
    hooks.setPower({ ...GRANTED, pending: true });
    await session.open();
    expect(session.power().phase).toEqual({ kind: 'counting', action: undefined });
  });
});
