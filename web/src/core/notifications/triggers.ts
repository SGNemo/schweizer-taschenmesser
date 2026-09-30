import { liveQuery } from 'dexie';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';

const INTERVAL_MS = 10 * 60 * 1000;
const DEBOUNCE_MS = 5_000;

/**
 * Runs `run` at start, every 10 minutes, when the app becomes visible and shortly after local
 * changes (any synced write passes the outbox: new reminder, moved date, module toggled).
 * Shared by the Web Push upload and the native (OS-scheduled) notifications. Returns a stop function.
 */
export function startScheduleTriggers(
  run: () => void,
  database: TaschenmesserDB = defaultDb,
): () => void {
  let debounce: ReturnType<typeof setTimeout> | undefined;
  const onVisible = () => {
    if (document.visibilityState === 'visible') run();
  };
  run();
  const interval = setInterval(run, INTERVAL_MS);
  document.addEventListener('visibilitychange', onVisible);

  let first = true;
  const subscription = liveQuery(() => database.table('_outbox').count()).subscribe({
    next: () => {
      if (first) first = false;
      else {
        clearTimeout(debounce);
        debounce = setTimeout(run, DEBOUNCE_MS);
      }
    },
    error: (e) => console.warn('[notifications] outbox stream failed', e),
  });

  return () => {
    clearInterval(interval);
    clearTimeout(debounce);
    document.removeEventListener('visibilitychange', onVisible);
    subscription.unsubscribe();
  };
}
