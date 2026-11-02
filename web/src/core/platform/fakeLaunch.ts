/**
 * E2E stand-in (only in `--mode e2e` builds): the pending value comes from
 * `localStorage.__tmLaunchPending` (taken once); the association switch is kept in memory.
 */
import type { LaunchService } from './launch';

export function createFakeLaunch(supported: boolean): LaunchService {
  let registered = false;
  const calls = (call: string) => {
    const w = window as unknown as { __tmBrowserCalls?: string[] };
    (w.__tmBrowserCalls ??= []).push(call);
  };
  return {
    supported,
    async takePending() {
      if (!supported) return null;
      try {
        const v = localStorage.getItem('__tmLaunchPending');
        localStorage.removeItem('__tmLaunchPending');
        return v;
      } catch {
        return null;
      }
    },
    onOpen: () => Promise.resolve(() => undefined),
    isRegistered: () => Promise.resolve(registered),
    async setRegistered(enabled) {
      registered = enabled;
      calls(`association:${enabled ? 'on' : 'off'}`);
    },
  };
}
