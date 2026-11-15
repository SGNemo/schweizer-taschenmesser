import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeRemoteParts } from '@/core/platform/fakeRemote';
import {
  ANSWER_WAIT_MS,
  OPEN_EVERY_MS,
  PROGRAM_STARTED_SHOWN_MS,
  createRemoteSession,
} from './session';

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

describe('remote session: programs', () => {
  it('has a list only when the PC sends one', async () => {
    const { session, hooks } = rig();
    await session.open();
    await pass(0);
    // the demo PC knows programs but this phone may not start any: no list, no menu
    expect(session.programs().list).toBeNull();
    hooks.setPrograms(['Editor', 'Browser']);
    await pass(0);
    expect(session.programs().list).toEqual(['Editor', 'Browser']);
    // an empty list is a list (the sheet says where it is made)
    hooks.setPrograms([]);
    await pass(0);
    expect(session.programs().list).toEqual([]);
    // leaving the page forgets it; a PC without programs never has one
    await session.close();
    expect(session.programs().list).toBeNull();
    hooks.setProgramsKnown(false);
    hooks.setPrograms(['Editor']);
    await done(session.open());
    await pass(0);
    expect(session.programs().list).toBeNull();
  });

  it('raises to the mouse level, then starts the slot the PC sent', async () => {
    const { session, hooks } = rig();
    hooks.setGrant('full', true);
    hooks.setPrograms(['Editor', 'Browser']);
    await session.open();
    await pass(0);
    expect(hooks.level()).toBe('media');
    const start = session.programStart(1, 'de');
    expect(session.programs().phase).toEqual({ kind: 'starting', name: 'Browser' });
    await done(start);
    expect(hooks.level()).toBe('full');
    expect(hooks.unlocks()).toBe(1);
    expect(hooks.started()).toEqual([1]);
    expect(session.programs().phase).toEqual({ kind: 'started', name: 'Browser' });
    // on the mouse level a second start asks nothing more
    await done(session.programStart(0, 'de'));
    expect(hooks.unlocks()).toBe(1);
    expect(hooks.started()).toEqual([1, 0]);
    session.programDismiss();
    expect(session.programs().phase).toEqual({ kind: 'idle' });
    // only what the PC sent can be started
    await session.programStart(5, 'de');
    expect(hooks.started()).toEqual([1, 0]);
    expect(session.programs().phase).toEqual({ kind: 'idle' });
  });

  it('says each answer of the PC as one calm line', async () => {
    const { session, hooks } = rig();
    hooks.setGrant('full');
    hooks.setPrograms(['Editor']);
    await session.open();
    await done(session.raise('de'));
    await pass(0);
    for (const answer of ['limit', 'failed', 'locked'] as const) {
      hooks.answerNextProgram(answer);
      await done(session.programStart(0, 'de'));
      expect(session.programs().phase).toEqual({ kind: 'refused', reason: answer });
    }
    // not allowed any more: the list goes with it
    hooks.answerNextProgram('not-granted');
    await done(session.programStart(0, 'de'));
    expect(session.programs()).toEqual({
      list: null,
      phase: { kind: 'refused', reason: 'not-granted' },
    });
    expect(hooks.started()).toEqual([]);
  });

  it('sends nothing to a locked PC and stops at a dismissed unlock', async () => {
    const { session, hooks } = rig();
    hooks.setGrant('full', true);
    hooks.setPrograms(['Editor']);
    await session.open();
    await pass(0);
    hooks.setUnlock('cancel');
    await done(session.programStart(0, 'de'));
    expect(session.programs().phase).toEqual({ kind: 'refused', reason: 'unlock' });
    expect(hooks.started()).toEqual([]);
    hooks.setUnlock('ok');
    await done(session.programStart(0, 'de'));
    expect(hooks.started()).toEqual([0]);
    hooks.setState({ locked: true });
    await done(session.programStart(0, 'de'));
    expect(session.programs().phase).toEqual({ kind: 'refused', reason: 'locked' });
    expect(hooks.started()).toEqual([0]);
  });

  it('a phone granted media only learns it without a start', async () => {
    const { session, hooks } = rig();
    hooks.setPrograms(['Editor']);
    await session.open();
    await pass(0);
    await done(session.programStart(0, 'de'));
    expect(session.programs().phase).toEqual({ kind: 'refused', reason: 'not-granted' });
    expect(hooks.started()).toEqual([]);
  });

  it('echoes the epoch of the list the PC sent; a list changed since starts nothing', async () => {
    const { session, hooks } = rig();
    hooks.setGrant('full');
    hooks.setPrograms(['Editor', 'Browser']);
    await session.open();
    await done(session.raise('de'));
    await pass(0);
    await done(session.programStart(1, 'de'));
    expect(hooks.started()).toEqual([1]);
    const [told] = hooks.epochs();
    // the list changes at the PC; the phone has not heard of it yet
    hooks.changeProgramsUntold(['Spiel', 'Editor']);
    await pass(5000);
    await done(session.programStart(1, 'de'));
    expect(hooks.epochs()).toEqual([told, told]);
    expect(session.programs().phase).toEqual({ kind: 'refused', reason: 'failed' });
    expect(hooks.started()).toEqual([1]);
    // the new list arrives: its epoch goes with the next start
    hooks.tellProgramsNow();
    await pass(0);
    expect(session.programs().list).toEqual(['Spiel', 'Editor']);
    await done(session.programStart(1, 'de'));
    expect(hooks.epochs()[2]).toBe((told ?? 0) + 1);
    expect(hooks.started()).toEqual([1, 1]);
  });

  it('keeps the epoch across a reopen: a tap right after media → full starts', async () => {
    const { session, hooks } = rig();
    hooks.setGrant('full', true);
    hooks.setPrograms(['Editor']);
    await session.open();
    await pass(0);
    expect(hooks.level()).toBe('media');
    // the raise opens a new session; the start goes before that session tells the list again
    await done(session.programStart(0, 'de'));
    expect(hooks.level()).toBe('full');
    expect(hooks.started()).toEqual([0]);
    expect(session.programs().phase).toEqual({ kind: 'started', name: 'Editor' });
  });

  it('a started line leaves by itself; a refusal stays until it is dismissed', async () => {
    const { session, hooks } = rig();
    hooks.setGrant('full');
    hooks.setPrograms(['Editor']);
    await session.open();
    await done(session.raise('de'));
    await pass(0);
    await session.programStart(0, 'de');
    await pass(0);
    expect(session.programs().phase).toEqual({ kind: 'started', name: 'Editor' });
    await pass(PROGRAM_STARTED_SHOWN_MS - 100);
    expect(session.programs().phase.kind).toBe('started');
    await pass(200);
    expect(session.programs().phase).toEqual({ kind: 'idle' });
    hooks.answerNextProgram('limit');
    await session.programStart(0, 'de');
    await pass(PROGRAM_STARTED_SHOWN_MS * 3);
    expect(session.programs().phase).toEqual({ kind: 'refused', reason: 'limit' });
    session.programDismiss();
    expect(session.programs().phase).toEqual({ kind: 'idle' });
  });

  it('a start whose answer never comes is not shown as started', async () => {
    const { session, hooks } = rig();
    hooks.setGrant('full');
    hooks.setPrograms(['Editor']);
    await session.open();
    await done(session.raise('de'));
    await pass(0);
    const start = session.programStart(0, 'de');
    // the connection drops before the PC's answer reaches the phone
    hooks.close(null);
    await pass(ANSWER_WAIT_MS + 3 * OPEN_EVERY_MS);
    await start;
    expect(session.programs().phase).toEqual({ kind: 'refused', reason: 'failed' });
  });
});
