import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const listeners = new Map<string, (event: unknown) => void>();
  return {
    listeners,
    unregister: vi.fn(async () => undefined),
    invoke: vi.fn(async (_cmd: string, _args?: unknown) => undefined),
  };
});
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
  addPluginListener: vi.fn(async (plugin: string, event: string, cb: (e: unknown) => void) => {
    mocks.listeners.set(`${plugin}:${event}`, cb);
    return { unregister: mocks.unregister };
  }),
}));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({}) }));

import { createDisplay } from './display';

beforeEach(() => {
  mocks.listeners.clear();
  mocks.unregister.mockClear();
  mocks.invoke.mockClear();
});

describe('display, Android: the volume keys', () => {
  it('asks the plugin for the keys and gives them back', async () => {
    const keys = createDisplay('android').volumeKeys!;
    await keys.hold(true);
    await keys.hold(false);
    expect(mocks.invoke.mock.calls).toEqual([
      ['plugin:screen-mode|set_volume_keys', { request: { enabled: true } }],
      ['plugin:screen-mode|set_volume_keys', { request: { enabled: false } }],
    ]);
  });

  it('sends them one after the other, also when the first is slow or fails', async () => {
    const order: boolean[] = [];
    let release: () => void = () => undefined;
    mocks.invoke.mockImplementationOnce(async (_cmd, args) => {
      await new Promise<void>((resolve) => (release = resolve));
      order.push((args as { request: { enabled: boolean } }).request.enabled);
      throw new Error('gone');
    });
    mocks.invoke.mockImplementationOnce(async (_cmd, args) => {
      order.push((args as { request: { enabled: boolean } }).request.enabled);
    });
    const keys = createDisplay('android').volumeKeys!;
    const taken = keys.hold(true).catch(() => 'failed');
    const given = keys.hold(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    release();
    expect(await taken).toBe('failed');
    await given;
    expect(order).toEqual([true, false]);
  });

  it('passes on only the two keys the plugin names, and stops listening', async () => {
    const keys = createDisplay('android').volumeKeys!;
    const seen: string[] = [];
    const stop = keys.onKey((key, repeat) => seen.push(`${key}:${repeat}`));
    await Promise.resolve();
    const fire = mocks.listeners.get('screen-mode:volume-key')!;
    fire({ key: 'up', repeat: false });
    fire({ key: 'down', repeat: true });
    fire({ key: 'mute' });
    fire({});
    expect(seen).toEqual(['up:false', 'down:true']);
    stop();
    expect(mocks.unregister).toHaveBeenCalledTimes(1);
  });

  it('a desktop window has no such keys', () => {
    expect(createDisplay('desktop').volumeKeys).toBeUndefined();
  });
});
