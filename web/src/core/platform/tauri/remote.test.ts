import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(async (_cmd: string, _args?: unknown): Promise<unknown> => undefined),
}));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
  Channel: class {
    onmessage: ((e: unknown) => void) | undefined;
  },
}));

import { createRemote } from './remote';

beforeEach(() => mocks.invoke.mockReset());

describe('remote bridge (phone)', () => {
  it('is the stub where the device cannot be a remote control', async () => {
    const remote = createRemote(false);
    expect(remote.supported).toBe(false);
    await expect(remote.pointer(1, 'move', 1, 1)).rejects.toThrow('unsupported');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('opens at a level and hands over a language for the unlock prompt, never a text', async () => {
    const remote = createRemote(true);
    mocks.invoke.mockResolvedValue({ session: 1 });
    await remote.open('media', () => {});
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      'remote_client_open',
      expect.objectContaining({ level: 'media', lang: null }),
    );
    await remote.open('full', () => {}, 'de');
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      'remote_client_open',
      expect.objectContaining({ level: 'full', lang: 'de' }),
    );
  });

  it('sends actions as names and pointer ways as whole numbers', async () => {
    const remote = createRemote(true);
    await remote.send(3, ['left-down', 'mute']);
    expect(mocks.invoke).toHaveBeenLastCalledWith('remote_client_send', {
      session: 3,
      actions: ['left-down', 'mute'],
    });
    await remote.pointer(3, 'scroll', 2.9, -2.9);
    expect(mocks.invoke).toHaveBeenLastCalledWith('remote_client_pointer', {
      session: 3,
      kind: 'scroll',
      dx: 2,
      dy: -2,
    });
    // nonsense is no way, and a huge one is bounded before it reaches the shell
    await remote.pointer(3, 'move', Number.NaN, Number.POSITIVE_INFINITY);
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      'remote_client_pointer',
      expect.objectContaining({ dx: 0, dy: 0 }),
    );
    await remote.pointer(3, 'move', 1e12, -1e12);
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      'remote_client_pointer',
      expect.objectContaining({ dx: 100_000, dy: -100_000 }),
    );
  });

  it('keeps the short code of the shell as the error message', async () => {
    const remote = createRemote(true);
    mocks.invoke.mockRejectedValueOnce('unlock-cancelled');
    await expect(remote.open('full', () => {})).rejects.toThrow('unlock-cancelled');
    mocks.invoke.mockRejectedValueOnce({ not: 'a code' });
    await expect(remote.pointer(1, 'move', 1, 1)).rejects.toThrow('failed');
  });

  it('hands text to the shell as it is and keeps nothing of it', async () => {
    const remote = createRemote(true);
    await remote.text(3, 'grüße 👋');
    expect(mocks.invoke).toHaveBeenLastCalledWith('remote_client_text', {
      session: 3,
      text: 'grüße 👋',
    });
    await remote.send(3, ['key-enter']);
    expect(mocks.invoke).toHaveBeenLastCalledWith('remote_client_send', {
      session: 3,
      actions: ['key-enter'],
    });
    mocks.invoke.mockRejectedValueOnce('locked');
    await expect(remote.text(3, 'abc')).rejects.toThrow('locked');
  });
});
