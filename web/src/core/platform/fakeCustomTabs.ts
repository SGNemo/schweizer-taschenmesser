/**
 * E2E stand-in for Custom Tabs (only wired in `--mode e2e` builds when posing as Android): opens
 * nothing and records the address on `window.__tmBrowserCalls`.
 */
import type { CustomTabsService } from './customTabs';

export function createFakeCustomTabs(supported: boolean): CustomTabsService {
  return {
    supported,
    async open(url) {
      const w = window as unknown as { __tmBrowserCalls?: string[] };
      (w.__tmBrowserCalls ??= []).push(`customTab:${url}`);
    },
  };
}
