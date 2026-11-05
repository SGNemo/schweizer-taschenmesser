import { useEffect, useState } from 'react';

/**
 * Changes whenever the effective colour scheme or the colour mode does (system setting, the app's theme switch on
 * `data-theme`, "Ruhig" on `data-color`, "Modulfarben" on `data-module-colors`), so the cover tint is re-checked
 * against the current theme's surface and text (C03).
 */
export function useThemeKey(): number {
  const [key, setKey] = useState(0);
  useEffect(() => {
    const bump = () => setKey((k) => k + 1);
    const mq =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : undefined;
    mq?.addEventListener('change', bump);
    const obs = new MutationObserver(bump);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-color', 'data-module-colors'],
    });
    return () => {
      mq?.removeEventListener('change', bump);
      obs.disconnect();
    };
  }, []);
  return key;
}
