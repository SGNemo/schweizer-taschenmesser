/** Stands in for `virtual:pwa-register/react` in native builds, which have no service worker. */
export function useRegisterSW() {
  return {
    needRefresh: [false, () => undefined] as const,
    offlineReady: [false, () => undefined] as const,
    updateServiceWorker: async () => undefined,
  };
}
