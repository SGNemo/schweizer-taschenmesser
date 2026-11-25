import { useEffect, useState } from 'react';
import type { SceneTheme } from '@/core/weather/scene';

export interface SceneEnv {
  theme: SceneTheme;
  /** "Ruhig" (`data-color="calm"`) or "Modulfarben: Aus" (`data-module-colors="off"`): the grey scene. */
  calm: boolean;
}

function read(): SceneEnv {
  if (typeof document === 'undefined') return { theme: 'light', calm: false };
  const d = document.documentElement.dataset;
  const dark =
    d.theme === 'dark' ||
    (d.theme !== 'light' &&
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-color-scheme: dark)').matches);
  return { theme: dark ? 'dark' : 'light', calm: d.color === 'calm' || d.moduleColors === 'off' };
}

/** The theme and colour mode the scene is drawn for; follows the system setting and the app's switches. */
export function useSceneEnv(): SceneEnv {
  const [env, setEnv] = useState(read);
  useEffect(() => {
    const update = () =>
      setEnv((prev) => {
        const next = read();
        return next.theme === prev.theme && next.calm === prev.calm ? prev : next;
      });
    const mq =
      typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : undefined;
    mq?.addEventListener('change', update);
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-color', 'data-module-colors'],
    });
    update();
    return () => {
      mq?.removeEventListener('change', update);
      obs.disconnect();
    };
  }, []);
  return env;
}
