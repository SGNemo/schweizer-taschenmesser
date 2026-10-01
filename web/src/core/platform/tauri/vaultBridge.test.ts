// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() =>
  vi.fn(async (_cmd: string, _args?: unknown): Promise<unknown> => undefined),
);
const FakeChannel = vi.hoisted(
  () =>
    class FakeChannel<T> {
      onmessage: (m: T) => void = () => undefined;
    },
);
vi.mock('@tauri-apps/api/core', () => ({ invoke, Channel: FakeChannel }));

import { createVaultBridge } from './vaultBridge';

beforeEach(() => invoke.mockReset());

describe('vault bridge service', () => {
  it('is inert when unsupported', async () => {
    const s = createVaultBridge(false);
    expect(s.supported).toBe(false);
    await expect(s.start(async () => '')).rejects.toThrow('unsupported');
    await s.stop();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('answers each relayed request with the handler result, by id', async () => {
    const s = createVaultBridge(true);
    const handler = vi.fn(async (req: { body: string }) => `reply:${req.body}`);
    expect(await s.start(handler)).toBeNull();
    const channel = invoke.mock.calls[0]?.[1] as {
      onRequest: InstanceType<typeof FakeChannel<{ id: number; body: string }>>;
    };
    channel.onRequest.onmessage({ id: 7, body: 'ping' });
    await vi.waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('vault_bridge_respond', { id: 7, body: 'reply:ping' }),
    );
  });

  it('answers with a code only when the handler throws', async () => {
    const s = createVaultBridge(true);
    await s.start(async () => {
      throw new Error('detail https://secret.example');
    });
    const channel = invoke.mock.calls[0]?.[1] as {
      onRequest: InstanceType<typeof FakeChannel<{ id: number; body: string }>>;
    };
    channel.onRequest.onmessage({ id: 1, body: '{}' });
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
    const { body } = invoke.mock.calls[1]?.[1] as { body: string };
    expect(JSON.parse(body)).toMatchObject({ ok: false, error: 'internal' });
    expect(body).not.toContain('secret.example');
  });

  it('maps start failures to codes and never throws', async () => {
    const s = createVaultBridge(true);
    invoke.mockRejectedValueOnce('channel-taken');
    expect(await s.start(async () => '')).toBe('channel-taken');
    invoke.mockRejectedValueOnce(new Error('boom'));
    expect(await s.start(async () => '')).toBe('failed');
  });

  it('passes registration calls to the shell', async () => {
    const s = createVaultBridge(true);
    invoke.mockResolvedValueOnce({ browsers: [], upToDate: true, manifest: 'x' });
    expect((await s.register()).upToDate).toBe(true);
    expect(invoke).toHaveBeenLastCalledWith('vault_bridge_register');
    await s.unregister();
    expect(invoke).toHaveBeenLastCalledWith('vault_bridge_unregister');
    await s.stop();
    expect(invoke).toHaveBeenLastCalledWith('vault_bridge_stop');
  });
});
