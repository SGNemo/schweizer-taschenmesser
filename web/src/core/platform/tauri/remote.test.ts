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

  it('opens at a level and hands the unlock prompt texts over only when given', async () => {
    const remote = createRemote(true);
    mocks.invoke.mockResolvedValue({ session: 1 });
    await remote.open('media', () => {});
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      'remote_client_open',
      expect.objectContaining({ level: 'media', prompt: null }),
    );
    const prompt = { title: 'T', subtitle: 'S', cancel: 'C' };
    await remote.open('full', () => {}, prompt);
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      'remote_client_open',
      expect.objectContaining({ level: 'full', prompt }),
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
  });

  it('keeps the short code of the shell as the error message', async () => {
    const remote = createRemote(true);
    mocks.invoke.mockRejectedValueOnce('unlock-cancelled');
    await expect(remote.open('full', () => {})).rejects.toThrow('unlock-cancelled');
    mocks.invoke.mockRejectedValueOnce({ not: 'a code' });
    await expect(remote.pointer(1, 'move', 1, 1)).rejects.toThrow('failed');
  });
});
