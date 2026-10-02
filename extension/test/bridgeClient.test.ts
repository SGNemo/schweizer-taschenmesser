import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXTENSION_ORIGIN } from '@nemo/vault-core';
import { REQUEST_TIMEOUT_MS, createBridgeClient, type PortLike } from '../src/lib/bridgeClient';

type Message = {
  id: string;
  op: string;
  session?: string;
  seq?: number;
  origin: string;
  body: object;
};

/** A port whose "app" is a function; it answers synchronously unless told otherwise. */
function fakePort(answer: (m: Message) => unknown | undefined) {
  let onMessage: (m: unknown) => void = () => undefined;
  let onDisconnect: () => void = () => undefined;
  const sent: Message[] = [];
  const port: PortLike & { sent: Message[]; kill(): void; push(m: unknown): void } = {
    sent,
    postMessage(m) {
      const message = m as Message;
      sent.push(message);
      const reply = answer(message);
      if (reply !== undefined) queueMicrotask(() => onMessage(reply));
    },
    disconnect: vi.fn(),
    onMessage: { addListener: (cb) => (onMessage = cb) },
    onDisconnect: { addListener: (cb) => (onDisconnect = cb) },
    kill: () => onDisconnect(),
    push: (m) => onMessage(m),
  };
  return port;
}

const ok = (m: Message, data: unknown) => ({ v: 1, id: m.id, ok: true, data });
const err = (m: Message, error: string) => ({ v: 1, id: m.id, ok: false, error });

let locked: boolean;
let app: (m: Message) => unknown;
beforeEach(() => {
  locked = false;
  let n = 0;
  app = (m) => {
    if (m.op === 'hello') {
      return locked
        ? ok(m, { state: 'locked' })
        : ok(m, { state: 'unlocked', session: `s-${++n}-xxxxxxxxxxxxxxxx` });
    }
    if (m.op === 'status') return ok(m, { state: locked ? 'locked' : 'unlocked' });
    if (locked) return err(m, 'locked');
    return ok(m, { echoed: m.op });
  };
});
afterEach(() => vi.useRealTimers());

const make = (answer = (m: Message) => app(m)) => {
  const port = fakePort(answer);
  const client = createBridgeClient({ connect: () => port, origin: EXTENSION_ORIGIN });
  return { port, client };
};

describe('connection state', () => {
  it('opens a session while unlocked', async () => {
    const { client } = make();
    expect(await client.connectState()).toEqual({ state: 'unlocked' });
    expect(client.hasSession()).toBe(true);
  });
  it('reports locked without a session', async () => {
    locked = true;
    const { client } = make();
    expect(await client.connectState()).toEqual({ state: 'locked' });
    expect(client.hasSession()).toBe(false);
  });
  it('reports the pairing code', async () => {
    const { client } = make((m) => ok(m, { state: 'pairing', pairCode: '123456' }));
    expect(await client.connectState()).toEqual({ state: 'pairing', pairCode: '123456' });
  });
  it('reports a rejected extension', async () => {
    const { client } = make((m) => ok(m, { state: 'rejected' }));
    expect(await client.connectState()).toEqual({ state: 'rejected' });
  });
  it('reports a missing app when the host is not there', async () => {
    const dead = {
      ...fakePort(() => undefined),
      postMessage: () => {
        throw new Error('gone');
      },
    };
    const client = createBridgeClient({ connect: () => dead, origin: EXTENSION_ORIGIN });
    expect(await client.connectState()).toEqual({ state: 'app-missing' });
    const throwing = createBridgeClient({
      connect: () => {
        throw new Error('no host');
      },
      origin: EXTENSION_ORIGIN,
    });
    expect(await throwing.connectState()).toEqual({ state: 'app-missing' });
  });
  it('turns the host error app-not-running into app-missing', async () => {
    const { client } = make((m) => err(m, 'app-not-running'));
    expect(await client.connectState()).toEqual({ state: 'app-missing' });
  });
  it('a port that disconnects ends the session and fails what is waiting', async () => {
    const { client, port } = make((m) => (m.op === 'hello' ? app(m) : undefined));
    await client.connectState();
    const waiting = client.call('match', { pageOrigin: 'https://example.com' });
    port.kill();
    expect(await waiting).toEqual({ ok: false, error: 'app-missing' });
    expect(client.hasSession()).toBe(false);
  });
});

describe('calls', () => {
  it('sends origin, session and a strictly increasing seq', async () => {
    const { client, port } = make();
    await client.call('genParams', {});
    await client.call('genParams', {});
    const calls = port.sent.filter((m) => m.op === 'genParams');
    expect(calls.map((m) => m.seq)).toEqual([1, 2]);
    expect(calls[0]?.session).toMatch(/^s-1-/);
    expect(new Set(port.sent.map((m) => m.id)).size).toBe(port.sent.length);
    expect(port.sent.every((m) => m.origin === EXTENSION_ORIGIN)).toBe(true);
  });
  it('passes the data of an answer through', async () => {
    const { client } = make();
    expect(await client.call('match', { pageOrigin: 'https://example.com' })).toEqual({
      ok: true,
      data: { echoed: 'match' },
    });
  });
  it('does not call without a session while locked, and sends no request body', async () => {
    locked = true;
    const { client, port } = make();
    expect(
      await client.call('secret', {
        entryId: 'e',
        pageOrigin: 'https://example.com',
        field: 'password',
      }),
    ).toEqual({ ok: false, error: 'locked' });
    expect(port.sent.map((m) => m.op)).toEqual(['hello']);
  });
  it('a lock in between drops the session and says locked', async () => {
    const { client } = make();
    await client.connectState();
    locked = true;
    expect(await client.call('match', { pageOrigin: 'https://example.com' })).toEqual({
      ok: false,
      error: 'locked',
    });
    expect(client.hasSession()).toBe(false);
  });
  it('says hello again once when the app forgot the session', async () => {
    let forget = true;
    const { client, port } = make((m) => {
      if (m.op === 'genParams' && forget) {
        forget = false;
        return err(m, 'no-session');
      }
      return app(m);
    });
    expect(await client.call('genParams', {})).toEqual({ ok: true, data: { echoed: 'genParams' } });
    expect(port.sent.filter((m) => m.op === 'hello')).toHaveLength(2);
  });
  it('passes error codes through', async () => {
    const { client } = make((m) => (m.op === 'secret' ? err(m, 'origin-mismatch') : app(m)));
    expect(
      await client.call('secret', {
        entryId: 'e',
        pageOrigin: 'https://evil.test',
        field: 'password',
      }),
    ).toEqual({ ok: false, error: 'origin-mismatch' });
  });
  it('requires a confirmed extension for calls', async () => {
    const { client } = make((m) => ok(m, { state: 'pairing', pairCode: '000000' }));
    expect(await client.call('genParams', {})).toEqual({ ok: false, error: 'not-paired' });
  });
});

describe('untrusted answers', () => {
  it('ignores replies with unknown fields, wrong ids and non-objects', async () => {
    vi.useFakeTimers();
    const { client, port } = make(() => undefined);
    const promise = client.connectState();
    const id = port.sent[0]!.id;
    port.push({
      v: 1,
      id,
      ok: true,
      data: { state: 'unlocked', session: 'x'.repeat(20) },
      extra: 1,
    });
    port.push({ v: 1, id: 'other', ok: true, data: {} });
    port.push('text');
    port.push(null);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 1);
    expect(await promise).toEqual({ state: 'rejected' }); // timed out: no state was granted
  });
  it('times out instead of waiting forever', async () => {
    vi.useFakeTimers();
    const { client } = make(() => undefined);
    const result = client.call('genParams', {});
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 1);
    expect(await result).toMatchObject({ ok: false });
  });
});

describe('reset', () => {
  it('drops session and port', async () => {
    const { client, port } = make();
    await client.connectState();
    client.reset();
    expect(client.hasSession()).toBe(false);
    expect(port.disconnect).toHaveBeenCalled();
  });
});
