// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setPlatform } from '@/core/platform';
import type { BrowserService } from '@/core/platform/browser';
import { createWebPlatform } from '@/core/platform/web';
import { OPEN_TIMEOUT_MS, useBrowserTabs } from '../tabsStore';

function nativeBrowser(open: BrowserService['open']) {
  const close = vi.fn(() => Promise.resolve());
  const web = createWebPlatform();
  setPlatform({ ...web, browser: { ...web.browser, supported: true, open, close } });
  return { close };
}

describe('tabs store: a failing native side never leaves an empty frame', () => {
  beforeEach(() => useBrowserTabs.setState({ tabs: [], activeId: null }));
  afterEach(() => {
    vi.useRealTimers();
    setPlatform(undefined);
  });

  it('a hanging open gives up after the timeout, closes the webview and keeps the address', async () => {
    vi.useFakeTimers();
    const { close } = nativeBrowser(() => new Promise<void>(() => {}));
    const id = useBrowserTabs.getState().newTab();
    const done = useBrowserTabs.getState().go(id, 'https://duckduckgo.com/?q=test');
    expect(useBrowserTabs.getState().tabs[0]).toMatchObject({ opened: true, error: null });
    await vi.advanceTimersByTimeAsync(OPEN_TIMEOUT_MS);
    await done;
    expect(useBrowserTabs.getState().tabs[0]).toMatchObject({
      opened: false,
      loading: false,
      error: 'timeout',
      url: 'https://duckduckgo.com/?q=test',
    });
    expect(close).toHaveBeenCalledWith(id);
  });

  it('a rejected open shows a reason kind, never the raw native message', async () => {
    nativeBrowser(() => Promise.reject(new Error('WebView2 said https://secret.example.org/')));
    const id = useBrowserTabs.getState().newTab();
    await useBrowserTabs.getState().go(id, 'https://example.org/');
    expect(useBrowserTabs.getState().tabs[0]!.error).toBe('native');
  });

  it('a retry clears the error and opens again', async () => {
    let fail = true;
    nativeBrowser(() => (fail ? Promise.reject(new Error('x')) : Promise.resolve()));
    const id = useBrowserTabs.getState().newTab();
    await useBrowserTabs.getState().go(id, 'https://example.org/');
    fail = false;
    await useBrowserTabs.getState().go(id, 'https://example.org/');
    expect(useBrowserTabs.getState().tabs[0]).toMatchObject({ opened: true, error: null });
  });

  it('a failed navigation keeps the open tab and its webview, and only says why', async () => {
    const web = createWebPlatform();
    const close = vi.fn(() => Promise.resolve());
    setPlatform({
      ...web,
      browser: {
        ...web.browser,
        supported: true,
        open: () => Promise.resolve(),
        navigate: () => Promise.reject(new Error('tab')),
        close,
      },
    });
    const id = useBrowserTabs.getState().newTab();
    await useBrowserTabs.getState().go(id, 'https://example.org/');
    await useBrowserTabs.getState().go(id, 'https://example.org/b');
    expect(useBrowserTabs.getState().tabs[0]).toMatchObject({ opened: true, error: 'native' });
    expect(close).not.toHaveBeenCalled();
  });

  it('a tab whose webview is gone offers reopening: the address stays, no native close is needed', async () => {
    const opens: number[] = [];
    const { close } = nativeBrowser((o) => {
      opens.push(o.tab);
      return Promise.resolve();
    });
    const id = useBrowserTabs.getState().newTab();
    const fresh = useBrowserTabs.getState().newTab();
    await useBrowserTabs.getState().go(id, 'https://example.org/');
    // The native side also names a tab the page never opened and one it does not know: both are ignored.
    useBrowserTabs.getState().markLost([id, fresh, 99]);
    const [lost, untouched] = useBrowserTabs.getState().tabs;
    expect(lost).toMatchObject({
      opened: false,
      loading: false,
      url: 'https://example.org/',
      error: 'gone',
    });
    expect(untouched).toMatchObject({ opened: false, error: null });
    // "Tab neu öffnen" creates the webview again instead of navigating a missing one.
    await useBrowserTabs.getState().go(id, 'https://example.org/');
    expect(opens).toEqual([id, id]);
    expect(useBrowserTabs.getState().tabs[0]).toMatchObject({ opened: true, error: null });
    expect(close).not.toHaveBeenCalled();
  });

  it('closing a tab survives a failing native close', async () => {
    const web = createWebPlatform();
    setPlatform({
      ...web,
      browser: {
        ...web.browser,
        supported: true,
        open: () => Promise.resolve(),
        close: () => Promise.reject(new Error('gone')),
      },
    });
    const id = useBrowserTabs.getState().newTab();
    await useBrowserTabs.getState().go(id, 'https://example.org/');
    await useBrowserTabs.getState().closeTab(id);
    expect(useBrowserTabs.getState().tabs).toHaveLength(0);
  });
});

describe('tabs store: "Tab neu öffnen" remembers the tab closed last, never a private one', () => {
  beforeEach(() => useBrowserTabs.setState({ tabs: [], activeId: null, lastClosed: null }));
  afterEach(() => setPlatform(undefined));

  it('keeps address and title of a closed tab, forgets on request', async () => {
    nativeBrowser(() => Promise.resolve());
    const id = useBrowserTabs.getState().newTab();
    await useBrowserTabs.getState().go(id, 'https://example.org/');
    await useBrowserTabs.getState().closeTab(id);
    expect(useBrowserTabs.getState().lastClosed).toMatchObject({ url: 'https://example.org/' });
    useBrowserTabs.getState().forgetClosed();
    expect(useBrowserTabs.getState().lastClosed).toBeNull();
  });

  it('a private tab and an empty tab leave nothing', async () => {
    nativeBrowser(() => Promise.resolve());
    const secret = useBrowserTabs.getState().newTab(true);
    await useBrowserTabs.getState().go(secret, 'https://private.example.org/');
    await useBrowserTabs.getState().closeTab(secret);
    expect(useBrowserTabs.getState().lastClosed).toBeNull();
    const empty = useBrowserTabs.getState().newTab();
    await useBrowserTabs.getState().closeTab(empty);
    expect(useBrowserTabs.getState().lastClosed).toBeNull();
  });

  it('"Daten löschen" (closeAll) forgets it', async () => {
    nativeBrowser(() => Promise.resolve());
    const id = useBrowserTabs.getState().newTab();
    await useBrowserTabs.getState().go(id, 'https://example.org/');
    await useBrowserTabs.getState().closeAll();
    expect(useBrowserTabs.getState().lastClosed).toBeNull();
  });
});
