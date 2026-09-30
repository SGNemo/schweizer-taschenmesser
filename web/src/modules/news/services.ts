import { getSettings } from '@/core/settings/settings';
import { refreshAll } from './fetch';
import { settings } from './settings';

const SCOPE = 'module.news';
const TICK = 5 * 60_000;

async function intervalMs(): Promise<number> {
  const values = (await getSettings(SCOPE, settings.schema, settings.defaults)) as {
    refreshMinutes: string;
  };
  return Number(values.refreshMinutes) * 60_000;
}

/** Runs while the module is on: fetches due feeds when the app is visible (start, timer, focus). */
export default function start(): () => void {
  let running = false;
  const run = () => {
    if (running || document.visibilityState === 'hidden') return;
    running = true;
    void intervalMs()
      .then((maxAgeMs) => refreshAll({ maxAgeMs }))
      .catch(() => undefined)
      .finally(() => {
        running = false;
      });
  };
  const first = setTimeout(run, 3_000);
  const timer = setInterval(run, TICK);
  document.addEventListener('visibilitychange', run);
  return () => {
    clearTimeout(first);
    clearInterval(timer);
    document.removeEventListener('visibilitychange', run);
  };
}
