// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setPlatform } from '@/core/platform';
import type { BrowserEvent } from '@/core/platform/browser';
import { createWebPlatform } from '@/core/platform/web';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { MAX_HOSTS, useBrowserTabs } from '../tabsStore';

// B1, B3 (launch review 2026-11): a page requesting from ever new hosts must not grow the tab's
// host list without end, and a tab whose request filter could not be installed says so.
async function openTab(): Promise<{ id: number; send: (e: BrowserEvent) => void }> {
  let send: (e: BrowserEvent) => void = () => undefined;
  const web = createWebPlatform();
  setPlatform({
    ...web,
    browser: {
      ...web.browser,
      supported: true,
      open: (_o, onEvent) => {
        send = onEvent;
        return Promise.resolve();
      },
      close: () => Promise.resolve(),
    },
  });
  const id = useBrowserTabs.getState().newTab();
  await useBrowserTabs.getState().go(id, 'https://page.example/');
  return { id, send: (e) => send(e) };
}

describe('browser tab events', () => {
  beforeEach(() => useBrowserTabs.setState({ tabs: [], activeId: null }));
  afterEach(() => setPlatform(undefined));

  it('lists third-party hosts up to a bound', async () => {
    const { id, send } = await openTab();
    for (let i = 0; i < MAX_HOSTS + 50; i++)
      send({ event: 'seen', tab: id, host: `h${i}.example` });
    expect(useBrowserTabs.getState().tabs[0]!.hosts).toHaveLength(MAX_HOSTS);
  });

  it('says when the ad blocker is not running in a tab', async () => {
    const { id, send } = await openTab();
    const seen: string[] = [];
    const stop = useUiStore.subscribe((s) => {
      const text = JSON.stringify(s);
      if (text.includes(t.browser.unfiltered)) seen.push(text);
    });
    send({ event: 'unfiltered', tab: id });
    stop();
    expect(seen.length).toBeGreaterThan(0);
  });
});
