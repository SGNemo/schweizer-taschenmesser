/**
 * E2E stand-in for the native browser tabs (only wired in `--mode e2e` builds). No real page is
 * loaded: it answers navigations with url/title events and records what the UI asked for on
 * `window.__tmBrowserCalls`, so specs can assert on it. Addresses are example.org-style test data.
 */
import type { BrowserEvent, BrowserService } from './browser';

type Win = { __tmBrowserCalls?: string[] };

export function createFakeBrowser(): BrowserService {
  const sinks = new Map<number, (e: BrowserEvent) => void>();
  const log = (call: string) => {
    const w = window as unknown as Win;
    (w.__tmBrowserCalls ??= []).push(call);
  };
  const load = (tab: number, url: string) => {
    const emit = sinks.get(tab);
    if (!emit) return;
    emit({ event: 'loading', tab, loading: true });
    emit({ event: 'url', tab, url });
    emit({ event: 'title', tab, title: `Testseite ${new URL(url).host}` });
    if (url.includes('download-test'))
      emit({ event: 'download', tab, url: `${new URL(url).origin}/files/beispiel-datei.zip` });
    if (url.includes('ads-test')) emit({ event: 'blocked', tab, host: 'ads.tracker.test' });
    emit({ event: 'seen', tab, host: 'cdn.thirdparty.test' });
    emit({ event: 'loading', tab, loading: false });
  };
  return {
    supported: true,
    async open(o, onEvent) {
      sinks.set(o.tab, onEvent);
      log(`open:${o.tab}:${o.privateTab ? 'private' : 'normal'}:${o.url}`);
      if (o.url.startsWith('http://') && !o.allowHttp) {
        onEvent({ event: 'httpHeld', tab: o.tab, url: o.url });
        return;
      }
      load(o.tab, o.url);
    },
    async navigate(tab, url, allowHttp) {
      log(`navigate:${tab}:${url}${allowHttp ? ':allowHttp' : ''}`);
      if (url.startsWith('http://') && !allowHttp) {
        sinks.get(tab)?.({ event: 'httpHeld', tab, url });
        return;
      }
      load(tab, url);
    },
    async back(tab) {
      log(`back:${tab}`);
    },
    async forward(tab) {
      log(`forward:${tab}`);
    },
    async reload(tab) {
      log(`reload:${tab}`);
    },
    async close(tab) {
      log(`close:${tab}`);
      sinks.delete(tab);
    },
    async show(tab) {
      log(`show:${tab}`);
    },
    async setZoom(tab, factor) {
      log(`zoom:${tab}:${factor}`);
    },
    async configure(config) {
      log(`configure:${config.warnHttp}:${config.blockerEnabled}:${config.rules.length}`);
    },
    async clearData() {
      log('clearData');
      sinks.clear();
    },
  };
}
