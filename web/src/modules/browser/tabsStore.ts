import { create } from 'zustand';
import { getPlatform } from '@/core/platform';
import type { BrowserBounds, BrowserEvent } from '@/core/platform/browser';
import { getSettings } from '@/core/settings/settings';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { isWebUrl } from './lib/urlPolicy';
import { historyRepo } from './repo';
import { settings } from './settings';

export interface Tab {
  id: number;
  url: string;
  title: string;
  loading: boolean;
  isPrivate: boolean;
  zoom: number;
  /** The native webview exists (a fresh tab shows the start page until the first address). */
  opened: boolean;
  /** A plain-HTTP address waiting for the user's decision. */
  held: string | null;
  blocked: number;
  /** Third-party hosts this page talked to. */
  hosts: string[];
}

interface TabsState {
  tabs: Tab[];
  activeId: number | null;
  bounds: BrowserBounds;
  /** Sites (host) where the blocker is paused; lives for the session only. */
  pausedHosts: string[];
  /** A page started a download; the browser page asks what to do with the address. */
  offer: { url: string } | null;
  newTab(isPrivate?: boolean): number;
  setActive(id: number): void;
  setBounds(bounds: BrowserBounds): void;
  /** Open `url` in the tab: creates the webview on first use, otherwise navigates. `allowHttp` = user confirmed. */
  go(id: number, url: string, allowHttp?: boolean): Promise<void>;
  closeTab(id: number): Promise<void>;
  closeAll(): Promise<void>;
  zoomBy(id: number, delta: number | 'reset'): Promise<void>;
  togglePause(host: string): void;
  dismissHeld(id: number): void;
  dismissOffer(): void;
}

let counter = 0;
/** Last history row per tab, so the title that arrives after the address lands on the same row. */
const lastHistory = new Map<number, { id: string; url: string }>();

const blank = (id: number, isPrivate: boolean): Tab => ({
  id,
  url: '',
  title: '',
  loading: false,
  isPrivate,
  zoom: 1,
  opened: false,
  held: null,
  blocked: 0,
  hosts: [],
});

function patch(id: number, p: Partial<Tab>): void {
  useBrowserTabs.setState((s) => ({ tabs: s.tabs.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
}

async function remember(tab: Tab, url: string): Promise<void> {
  const prefs = await getSettings('module.browser', settings.schema, settings.defaults);
  if (!(prefs as { history?: boolean }).history || tab.isPrivate || !isWebUrl(url)) return;
  const last = lastHistory.get(tab.id);
  if (last?.url === url) return;
  const row = await historyRepo.create({ title: '', url });
  lastHistory.set(tab.id, { id: row.id, url });
}

function onEvent(e: BrowserEvent): void {
  const tab = useBrowserTabs.getState().tabs.find((x) => x.id === e.tab);
  if (!tab) return;
  switch (e.event) {
    case 'url':
      patch(e.tab, {
        url: e.url,
        blocked: e.url === tab.url ? tab.blocked : 0,
        hosts: e.url === tab.url ? tab.hosts : [],
      });
      void remember(tab, e.url);
      break;
    case 'title': {
      patch(e.tab, { title: e.title });
      const last = lastHistory.get(e.tab);
      if (last) void historyRepo.update(last.id, { title: e.title });
      break;
    }
    case 'loading':
      patch(e.tab, { loading: e.loading });
      break;
    case 'httpHeld':
      patch(e.tab, { held: e.url, loading: false });
      break;
    case 'popupBlocked':
      useUiStore.getState().toast(t.browser.popupBlocked);
      break;
    case 'download':
      // Never saved by the webview: the address is offered to the Downloads module (a click starts it).
      useBrowserTabs.setState({ offer: { url: e.url } });
      break;
    case 'blocked':
      patch(e.tab, { blocked: tab.blocked + 1 });
      break;
    case 'seen':
      if (!tab.hosts.includes(e.host)) patch(e.tab, { hosts: [...tab.hosts, e.host] });
      break;
  }
}

export const useBrowserTabs = create<TabsState>((set, get) => ({
  tabs: [],
  activeId: null,
  bounds: { x: 0, y: 0, width: 800, height: 600 },
  pausedHosts: [],
  offer: null,
  newTab(isPrivate = false) {
    const id = ++counter;
    set((s) => ({ tabs: [...s.tabs, blank(id, isPrivate)], activeId: id }));
    return id;
  },
  setActive: (id) => set({ activeId: id }),
  setBounds: (bounds) => set({ bounds }),
  async go(id, url, allowHttp = false) {
    const tab = get().tabs.find((x) => x.id === id);
    if (!tab) return;
    patch(id, { held: null });
    const browser = getPlatform().browser;
    if (!tab.opened) {
      patch(id, { opened: true, url, loading: true });
      await browser.open(
        {
          tab: id,
          url,
          bounds: get().bounds,
          privateTab: tab.isPrivate,
          zoom: tab.zoom,
          allowHttp,
        },
        onEvent,
      );
    } else {
      await browser.navigate(id, url, allowHttp);
    }
  },
  async closeTab(id) {
    const { tabs, activeId } = get();
    const tab = tabs.find((x) => x.id === id);
    if (!tab) return;
    if (tab.opened) await getPlatform().browser.close(id);
    lastHistory.delete(id);
    const rest = tabs.filter((x) => x.id !== id);
    set({ tabs: rest, activeId: activeId === id ? (rest[rest.length - 1]?.id ?? null) : activeId });
  },
  async closeAll() {
    for (const tab of get().tabs) await get().closeTab(tab.id);
  },
  async zoomBy(id, delta) {
    const tab = get().tabs.find((x) => x.id === id);
    if (!tab) return;
    const zoom =
      delta === 'reset'
        ? 1
        : Math.min(3, Math.max(0.25, Math.round((tab.zoom + delta) * 100) / 100));
    patch(id, { zoom });
    if (tab.opened) await getPlatform().browser.setZoom(id, zoom);
  },
  togglePause(host) {
    set((s) => ({
      pausedHosts: s.pausedHosts.includes(host)
        ? s.pausedHosts.filter((h) => h !== host)
        : [...s.pausedHosts, host],
    }));
  },
  dismissHeld: (id) => patch(id, { held: null }),
  dismissOffer: () => set({ offer: null }),
}));
