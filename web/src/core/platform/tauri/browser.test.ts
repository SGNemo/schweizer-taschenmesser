import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn(async (..._args: unknown[]) => [] as number[]);
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invoke(...args),
  Channel: class {
    onmessage: unknown;
  },
}));

import { createBrowser, pageEpoch } from './browser';

/**
 * `browser_show` is numbered so that an overtaken call does nothing. The native state lives as long as the app,
 * the page's counter starts again with every reload of the main window ("Neu laden" on the loading card): each
 * page life sends its own epoch, or every show after a reload would be ignored until the counter caught up.
 */
beforeEach(() => invoke.mockClear());

const shows = () =>
  invoke.mock.calls
    .filter(([cmd]) => cmd === 'browser_show')
    .map(([, args]) => args as { epoch: number; seq: number });

describe('browser.show numbering', () => {
  it('counts up within one page life and sends the same epoch', async () => {
    const browser = createBrowser(true);
    await browser.show(1);
    await browser.show(null);
    const [a, b] = shows();
    expect([a!.seq, b!.seq]).toEqual([1, 2]);
    expect(a!.epoch).toBe(b!.epoch);
    expect(a!.epoch).toBeGreaterThan(0);
  });

  it('a new page life counts from 1 again under another epoch', async () => {
    await createBrowser(true).show(1);
    await createBrowser(true).show(1);
    const [before, after] = shows();
    expect(after!.seq).toBe(1);
    expect(after!.epoch).not.toBe(before!.epoch);
  });

  it('the epoch is never the native start value 0', () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      (array as Uint32Array)[0] = 0;
      return array;
    });
    expect(pageEpoch()).toBe(1);
    vi.restoreAllMocks();
  });
});
