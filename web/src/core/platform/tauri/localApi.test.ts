import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(async (_cmd: string, _args?: unknown): Promise<unknown> => 47631),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
  Channel: class {
    onmessage: (msg: unknown) => void = () => {};
  },
}));

import { createLocalApi } from './localApi';

beforeEach(() => vi.clearAllMocks());

describe('native local API bridge', () => {
  it('is only supported on desktop', async () => {
    const api = createLocalApi(false);
    expect(api.supported).toBe(false);
    await expect(api.start(1, [], async () => ({ status: 200, body: '' }))).rejects.toThrow();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('starts with hashes only and answers forwarded requests by id', async () => {
    const api = createLocalApi(true);
    const onRequest = vi.fn(async () => ({ status: 200, body: '{"ok":true}' }));
    const tokens = [{ id: 't1', hash: 'ab'.repeat(32), expiresAt: null }];
    expect(await api.start(47631, tokens, onRequest)).toBe(47631);
    const [cmd, args] = mocks.invoke.mock.calls[0]! as [string, Record<string, unknown>];
    expect(cmd).toBe('local_api_start');
    expect(args.port).toBe(47631);
    expect(args.tokens).toEqual(tokens);

    const channel = args.onRequest as { onmessage: (m: unknown) => void };
    channel.onmessage({ id: 7, tokenId: 't1', method: 'GET', path: '/v1/modules', query: '' });
    await vi.waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('local_api_respond', {
        id: 7,
        status: 200,
        body: '{"ok":true}',
      }),
    );
  });

  it('turns a failing handler into a 500 instead of leaving the request hanging', async () => {
    const api = createLocalApi(true);
    await api.start(47631, [], async () => {
      throw new Error('boom');
    });
    const channel = (
      mocks.invoke.mock.calls[0]![1] as { onRequest: { onmessage: (m: unknown) => void } }
    ).onRequest;
    channel.onmessage({ id: 3 });
    await vi.waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('local_api_respond', {
        id: 3,
        status: 500,
        body: '{"error":"internal"}',
      }),
    );
  });

  it('passes token updates and stop through', async () => {
    const api = createLocalApi(true);
    await api.setTokens([]);
    await api.stop();
    expect(mocks.invoke).toHaveBeenCalledWith('local_api_set_tokens', { tokens: [] });
    expect(mocks.invoke).toHaveBeenCalledWith('local_api_stop');
  });
});
