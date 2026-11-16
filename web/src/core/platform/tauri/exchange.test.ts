import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(async (_cmd: string, _args?: unknown): Promise<unknown> => undefined),
  listen: vi.fn(async (_name: string, _cb: () => void) => () => undefined),
  channels: [] as { onmessage?: (e: unknown) => void }[],
}));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
  Channel: class {
    onmessage: ((e: unknown) => void) | undefined;
    constructor() {
      mocks.channels.push(this);
    }
  },
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: mocks.listen }));

import { createExchange } from './exchange';

beforeEach(() => {
  mocks.invoke.mockReset();
  mocks.channels.length = 0;
});

describe('exchange bridge', () => {
  it('is the stub where there is no home-network channel', async () => {
    const ex = createExchange(null);
    expect(ex.side).toBeNull();
    await expect(ex.status()).rejects.toThrow('unsupported');
    expect(await ex.take()).toEqual({ items: [], answers: [] });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('PC: sends, takes, confirms and asks for grants through its own commands', async () => {
    const ex = createExchange('pc');
    await ex.send('aa', { id: '01'.repeat(16), kind: 'link', body: 'https://example.org' });
    expect(mocks.invoke).toHaveBeenLastCalledWith('exchange_send', {
      peer: 'aa',
      id: '01'.repeat(16),
      kind: 'link',
      body: 'https://example.org',
    });
    await ex.setDevice('aa', true, false);
    expect(mocks.invoke).toHaveBeenLastCalledWith('exchange_set_device', {
      id: 'aa',
      on: true,
      paused: false,
    });
    await ex.confirm([{ peer: 'aa', id: 'x' }]);
    expect(mocks.invoke).toHaveBeenLastCalledWith('exchange_confirm', {
      items: [{ peer: 'aa', id: 'x' }],
      answers: [],
    });
    mocks.invoke.mockRejectedValueOnce('cancelled');
    await expect(ex.setEnabled(true)).rejects.toThrow('cancelled');
    await expect(ex.open(() => {})).rejects.toThrow('unsupported');
  });

  it('phone: opens a session; its channel goes quiet once the session is over', async () => {
    const ex = createExchange('phone');
    mocks.invoke.mockResolvedValueOnce(7);
    const events: unknown[] = [];
    const s = await ex.open((e) => events.push(e));
    const channel = mocks.channels[0]!;
    channel.onmessage?.({ type: 'received', session: 7 });
    channel.onmessage?.({ type: 'closed', session: 7, reason: 'limit', minutes: 12 });
    channel.onmessage?.({ type: 'received', session: 7 });
    expect(events).toEqual([
      { type: 'received' },
      { type: 'closed', reason: 'limit', minutes: 12 },
    ]);
    await s.send({ id: 'ab', kind: 'text', body: 'hallo' });
    expect(mocks.invoke).toHaveBeenLastCalledWith('exchange_client_send', {
      session: 7,
      id: 'ab',
      kind: 'text',
      body: 'hallo',
    });
    await s.ping();
    expect(mocks.invoke).toHaveBeenLastCalledWith('exchange_client_ping', { session: 7 });
    await expect(ex.status()).rejects.toThrow('unsupported');
    // a failed open leaves its channel quiet too
    mocks.invoke.mockRejectedValueOnce('exchange-off');
    const later: unknown[] = [];
    await expect(ex.open((e) => later.push(e))).rejects.toThrow('exchange-off');
    mocks.channels[1]!.onmessage?.({ type: 'received', session: 8 });
    expect(later).toEqual([]);
  });
});
