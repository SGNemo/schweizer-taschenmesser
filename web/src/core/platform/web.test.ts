import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlatform, initPlatform, setPlatform } from './index';
import { browserDownload, createWebPlatform, onPageHidden, sensitiveClipboard } from './web';

afterEach(() => {
  setPlatform(undefined);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('platform selection', () => {
  it('is the browser implementation by default and in a plain browser', async () => {
    expect(getPlatform()).toMatchObject({ kind: 'web', isNative: false });
    expect(await initPlatform()).toMatchObject({ kind: 'web' });
  });

  it('can be replaced for tests and restored', () => {
    const fake = { ...createWebPlatform(), kind: 'desktop', isNative: true } as const;
    setPlatform(fake);
    expect(getPlatform().isNative).toBe(true);
    setPlatform(undefined);
    expect(getPlatform().isNative).toBe(false);
  });
});

describe('web platform', () => {
  it('fetch delegates to the current global fetch', async () => {
    const spy = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', spy);
    try {
      await createWebPlatform().fetch('https://x.test/a', { method: 'POST' });
      expect(spy).toHaveBeenCalledWith('https://x.test/a', { method: 'POST' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('saves files as a browser download and releases the blob later', async () => {
    vi.useFakeTimers();
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
      created.push(b as Blob);
      return 'blob:x';
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    expect(
      await createWebPlatform().saveFile({
        fileName: 'a.json',
        data: '{"a":1}',
        mime: 'application/json',
      }),
    ).toBe('saved');
    expect(click).toHaveBeenCalledTimes(1);
    expect(created[0]!.type).toBe('application/json');
    expect(await created[0]!.text()).toBe('{"a":1}');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_001);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
    expect(document.querySelector('a[download]')).toBeNull(); // the temporary link is removed
  });

  it('keeps Blobs and binary data intact', async () => {
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => (blobs.push(b as Blob), 'blob:y'));
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const original = new Blob(['x'], { type: 'text/plain' });
    browserDownload({ fileName: 'x.txt', data: original, mime: 'text/plain' });
    browserDownload({
      fileName: 'b.bin',
      data: new Uint8Array([1, 2, 3]),
      mime: 'application/octet-stream',
    });
    expect(blobs[0]).toBe(original);
    expect(blobs[1]!.size).toBe(3);
  });

  it('reports the app version injected at build time (0.0.0 without it)', async () => {
    expect(await createWebPlatform().app.version()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('opens links without giving the page an opener', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    await createWebPlatform().app.openUrl('https://example.com');
    expect(open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
  });
});

describe('background lifecycle', () => {
  const setVisibility = (state: DocumentVisibilityState) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  beforeEach(() => setVisibility('visible'));
  afterEach(() => setVisibility('visible'));

  it('calls back only when the page becomes hidden, until unsubscribed', () => {
    const cb = vi.fn();
    const off = onPageHidden(cb);
    setVisibility('hidden');
    expect(cb).toHaveBeenCalledTimes(1);
    setVisibility('visible');
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    setVisibility('hidden');
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('sensitive clipboard', () => {
  function fakeClipboard(initial = '') {
    const state = { text: initial, cleared: 0 };
    return {
      state,
      io: {
        write: async (t: string) => void (state.text = t),
        read: async () => state.text,
        clear: async () => {
          state.text = '';
          state.cleared++;
        },
      },
    };
  }

  it('clears the clipboard after the delay', async () => {
    vi.useFakeTimers();
    const { state, io } = fakeClipboard();
    await sensitiveClipboard(io)('hunter2', 30_000);
    expect(state.text).toBe('hunter2');
    await vi.advanceTimersByTimeAsync(29_999);
    expect(state.text).toBe('hunter2');
    await vi.advanceTimersByTimeAsync(2);
    expect(state.text).toBe('');
  });

  it('leaves alone what the user copied in the meantime', async () => {
    vi.useFakeTimers();
    const { state, io } = fakeClipboard();
    await sensitiveClipboard(io)('secret', 30_000);
    state.text = 'something else';
    await vi.advanceTimersByTimeAsync(31_000);
    expect(state.text).toBe('something else');
    expect(state.cleared).toBe(0);
  });

  it('restarts the timer on a second copy and wipes when reading is impossible', async () => {
    vi.useFakeTimers();
    const { state, io } = fakeClipboard();
    const copy = sensitiveClipboard({
      ...io,
      read: async () => Promise.reject(new Error('denied')),
    });
    await copy('one', 30_000);
    await vi.advanceTimersByTimeAsync(20_000);
    await copy('two', 30_000);
    await vi.advanceTimersByTimeAsync(20_000); // 40 s after the first copy, 20 s after the second
    expect(state.text).toBe('two');
    await vi.advanceTimersByTimeAsync(11_000);
    expect(state.text).toBe('');
  });
});
