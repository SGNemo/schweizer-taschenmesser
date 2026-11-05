import { useEffect, useState } from 'react';

/**
 * Changes whenever the effective colours do (system setting, the app's theme, "Ruhig", module
 * colours or accent: attributes on <html>), so canvas drawings can re-read their colours.
 */
export function useThemeKey(): number {
  const [key, setKey] = useState(0);
  useEffect(() => {
    const bump = () => setKey((k) => k + 1);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', bump);
    const obs = new MutationObserver(bump);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-color', 'data-module-colors', 'data-accent'],
    });
    return () => {
      mq.removeEventListener('change', bump);
      obs.disconnect();
    };
  }, []);
  return key;
}
