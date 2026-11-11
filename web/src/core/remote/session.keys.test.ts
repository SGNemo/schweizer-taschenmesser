import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeRemoteParts } from '@/core/platform/fakeRemote';
import { OPEN_EVERY_MS, createRemoteSession, textPieces } from './session';

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
async function ready() {
  const r = rig();
  r.hooks.setGrant('full');
  await r.session.open();
  await done(r.session.raise('de'));
  return r;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

describe('remote session: text and keys', () => {
  it('types a line and presses Enter after it, in that order', async () => {
    const { session, hooks, remote } = await ready();
    const order: string[] = [];
    const text = remote.text.bind(remote);
    const send = remote.send.bind(remote);
    vi.spyOn(remote, 'text').mockImplementation(async (id, t) => {
      order.push(`text:${t}`);
      return text(id, t);
    });
    vi.spyOn(remote, 'send').mockImplementation(async (id, actions) => {
      order.push(actions.join('+'));
      return send(id, actions);
    });
    const typed = session.type('grüße 👋', true);
    expect(session.key('key-tab')).toBe(true);
    expect(await done(typed)).toBe('sent');
    await pass(0);
    expect(order).toEqual(['text:grüße 👋', 'key-enter', 'key-tab']);
    expect(hooks.typed()).toEqual(['grüße 👋']);
    expect(hooks.sent()).toEqual(['key-enter', 'key-tab']);
  });

  it('"Senden" types without Enter; an empty line with Enter is the key alone', async () => {
    const { session, hooks } = await ready();
    expect(await done(session.type('abc', false))).toBe('sent');
    expect(hooks.sent()).toEqual([]);
    expect(await done(session.type('', true))).toBe('sent');
    expect(hooks.typed()).toEqual(['abc']);
    expect(hooks.sent()).toEqual(['key-enter']);
    // nothing to type and no Enter: nothing goes out
    expect(await done(session.type('', false))).toBe('sent');
    expect(hooks.typed()).toEqual(['abc']);
  });

  it('a pasted line break or tab is a space, never a key; long text goes in whole pieces', async () => {
    expect(textPieces('a\nb\tc\r\nd e')).toEqual(['a b c d e']);
    expect(textPieces('')).toEqual([]);
    const long = '👋'.repeat(900);
    const pieces = textPieces(long);
    expect(pieces.length).toBe(3);
    expect(pieces.join('')).toBe(long);
    // every piece is whole characters and fits the shell's limit
    for (const piece of pieces) {
      expect(new TextEncoder().encode(piece).length).toBeLessThanOrEqual(2048);
      expect(piece.isWellFormed()).toBe(true);
    }
    const { session, hooks } = await ready();
    expect(await done(session.type(long, false))).toBe('sent');
    expect(hooks.typed().join('')).toBe(long);
  });

  it('on a locked PC nothing is typed and no key goes; the session stays', async () => {
    const { session, hooks } = await ready();
    hooks.setState({ locked: true });
    expect(await done(session.type('geheim', true))).toBe('locked');
    expect(session.key('key-enter')).toBe(false);
    await pass(0);
    expect(hooks.typed()).toEqual([]);
    expect(hooks.sent()).toEqual([]);
    expect(session.view().kind).toBe('connected');
  });

  it('the PC locks while a text waits: the answer says so and the session stays', async () => {
    const { session, hooks, remote } = await ready();
    vi.spyOn(remote, 'text').mockRejectedValueOnce(new Error('locked'));
    expect(await done(session.type('abc', true))).toBe('locked');
    expect(session.view().kind).toBe('connected');
    expect(session.pad().kind).toBe('ready');
    expect(hooks.sent()).toEqual([]);
  });

  it('without the level nothing is typed: Medien alone, media grant, lost session', async () => {
    const a = rig();
    a.hooks.setGrant('full');
    await a.session.open();
    expect(await a.session.type('abc', true)).toBe('failed');
    expect(a.session.key('key-enter')).toBe(false);
    expect(a.hooks.typed()).toEqual([]);

    const b = await ready();
    b.hooks.close();
    expect(await b.session.type('abc', false)).toBe('failed');
    expect(b.hooks.typed()).toEqual([]);
  });

  it('a write that fails ends the session and answers the text that waited', async () => {
    const { session, hooks, remote } = await ready();
    vi.spyOn(remote, 'text').mockRejectedValueOnce(new Error('network'));
    const first = session.type('eins', false);
    const second = session.type('zwei', true);
    expect(await done(first)).toBe('failed');
    expect(await done(second)).toBe('failed');
    expect(session.view().kind).toBe('disconnected');
    expect(hooks.typed()).toEqual([]);
  });

  it('leaving the page answers a text that waited and types nothing later', async () => {
    const { session, hooks, remote } = await ready();
    let release: () => void = () => undefined;
    const text = remote.text.bind(remote);
    vi.spyOn(remote, 'text').mockImplementationOnce(async (id, t) => {
      await new Promise<void>((resolve) => (release = resolve));
      return text(id, t);
    });
    const first = session.type('eins', false);
    const second = session.type('zwei', false);
    await pass(0);
    await session.close();
    expect(await second).toBe('failed');
    release();
    await pass(0);
    await first;
    expect(hooks.typed()).not.toContain('zwei');
  });
});
