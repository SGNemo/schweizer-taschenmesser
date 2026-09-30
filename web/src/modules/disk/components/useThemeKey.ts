import { useEffect, useState } from 'react';

/**
 * Changes whenever the effective colour scheme does (system setting or the app's own theme
 * switch, which sets `data-theme` on <html>), so canvas drawings can re-read their colours.
 */
export function useThemeKey(): number {
  const [key, setKey] = useState(0);
  useEffect(() => {
    const bump = () => setKey((k) => k + 1);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', bump);
    const obs = new MutationObserver(bump);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', bump);
      obs.disconnect();
    };
  }, []);
  return key;
}
