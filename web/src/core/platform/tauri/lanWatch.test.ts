import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, () => void>();
  const unregister = vi.fn(async () => undefined);
  return {
    handlers,
    unregister,
    invoke: vi.fn(async (_cmd: string): Promise<unknown> => ({ supported: true, connected: true })),
    addPluginListener: vi.fn(async (_plugin: string, event: string, cb: () => void) => {
      handlers.set(event, cb);
      return { unregister };
    }),
  };
});
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
  addPluginListener: mocks.addPluginListener,
}));

import { createLanWatch } from './lanWatch';

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  mocks.handlers.clear();
  mocks.invoke.mockClear();
  mocks.addPluginListener.mockClear();
  mocks.unregister.mockClear();
});

describe('lan-watch service', () => {
  it('is inert outside Android', async () => {
    const w = createLanWatch(false);
    expect(w.supported).toBe(false);
    expect(await w.wifi()).toBeUndefined();
    w.onWifiChange(() => undefined)();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.addPluginListener).not.toHaveBeenCalled();
  });

  it('reads the Wi-Fi state from the plugin; a failure is "unknown", never "no Wi-Fi"', async () => {
    const w = createLanWatch(true);
    expect(await w.wifi()).toBe(true);
    expect(mocks.invoke).toHaveBeenCalledWith('plugin:lan-watch|wifi_state');
    mocks.invoke.mockResolvedValueOnce({ supported: true, connected: false });
    expect(await w.wifi()).toBe(false);
    mocks.invoke.mockRejectedValueOnce(new Error('denied'));
    expect(await w.wifi()).toBeUndefined();
  });

  it('turns the plugin events into connected/lost and unregisters both', async () => {
    const w = createLanWatch(true);
    const seen: boolean[] = [];
    const stop = w.onWifiChange((c) => seen.push(c));
    await flush();
    expect(mocks.addPluginListener).toHaveBeenCalledWith(
      'lan-watch',
      'wifi-available',
      expect.any(Function),
    );
    mocks.handlers.get('wifi-available')!();
    mocks.handlers.get('wifi-lost')!();
    expect(seen).toEqual([true, false]);
    stop();
    expect(mocks.unregister).toHaveBeenCalledTimes(2);
  });

  it('a listener that registers after stop is removed at once', async () => {
    const w = createLanWatch(true);
    w.onWifiChange(() => undefined)();
    await flush();
    expect(mocks.unregister).toHaveBeenCalledTimes(2);
  });
});
