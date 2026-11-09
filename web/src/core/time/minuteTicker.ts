import { now } from './now';

export const MINUTE_MS = 60_000;

/** Milliseconds from `at` to the next full minute (a full minute itself → a whole minute). */
export function msToNextMinute(at: number): number {
  return MINUTE_MS - (((at % MINUTE_MS) + MINUTE_MS) % MINUTE_MS);
}

/**
 * Calls `onTick(now())` once at every full minute: the timer is aimed at the next `:00` each time (no
 * interval drift), a timer that fires a hair early is re-aimed without a tick, and when the page becomes
 * visible again (timers sleep in the background) a changed minute is shown at once. Returns the stop function.
 * Time zone offsets are whole minutes, so epoch minutes are local minutes. `shownAt` is the time on screen now:
 * if the minute already turned since then, the first tick comes at once.
 */
export function startMinuteTicker(
  onTick: (at: number) => void,
  shownAt: number = now(),
  doc: Document = document,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = Math.floor(shownAt / MINUTE_MS);
  const tickIfNew = () => {
    const at = now();
    const minute = Math.floor(at / MINUTE_MS);
    if (minute === last) return;
    last = minute;
    onTick(at);
  };
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      tickIfNew();
      arm();
    }, msToNextMinute(now()));
  };
  const onVisibility = () => {
    if (doc.visibilityState !== 'visible') return;
    tickIfNew();
    arm();
  };
  doc.addEventListener('visibilitychange', onVisibility);
  tickIfNew();
  arm();
  return () => {
    clearTimeout(timer);
    doc.removeEventListener('visibilitychange', onVisibility);
  };
}
