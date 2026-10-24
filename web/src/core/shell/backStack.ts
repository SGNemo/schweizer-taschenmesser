/**
 * "Back" closes what is open first (Android back gesture, browser back button): every open
 * dialog, row menu or sheet registers here and gets one history entry with a marker. A `popstate`
 * closes the topmost one instead of leaving the page. Pure logic over `window.history`; the React
 * side is `useBackClose`.
 *
 * - One entry per element (by id): registering twice adds nothing.
 * - Closing with a button releases the entry; `history.back()` only runs when our marker is on
 *   top, and the resulting `popstate` is swallowed (it is ours).
 * - A close handler may answer `'keep'` ("discard the draft?" is shown): the entry is put back.
 * - A marker entry left behind (the router moved on while a menu was open) is skipped on the way
 *   back, so one press never lands on a page that looks unchanged.
 */
export type BackResult = void | 'keep';

interface Entry {
  id: string;
  close: () => BackResult;
}

const MARK = 'tmBack';

let stack: Entry[] = [];
/** `history.back()` calls of ours whose `popstate` has not arrived yet. */
let swallow = 0;
/** Pushes that wait until our own `history.back()` has settled (a push in between would be undone). */
let waiting: Array<() => void> = [];
let listening = false;

function markerOnTop(): string | undefined {
  const state = history.state as Record<string, unknown> | null;
  const id = state?.[MARK];
  return typeof id === 'string' ? id : undefined;
}

function pushEntry(id: string): void {
  const run = () => history.pushState({ ...(history.state ?? {}), [MARK]: id }, '');
  if (swallow > 0) waiting.push(run);
  else run();
}

function back(): void {
  swallow += 1;
  history.back();
}

function onPop(): void {
  if (swallow > 0) {
    swallow -= 1;
    if (swallow === 0) {
      const queued = waiting;
      waiting = [];
      for (const run of queued) run();
    }
    return;
  }
  const top = stack[stack.length - 1];
  if (!top) {
    // Landed on a marker nobody owns any more (see above): step over it.
    if (markerOnTop()) back();
    return;
  }
  const result = top.close();
  if (result === 'keep') {
    pushEntry(top.id);
    return;
  }
  // Still ours (a handler that does not unmount): its entry is gone with this pop.
  stack = stack.filter((e) => e !== top);
}

/** Registers an open element. A second call with the same id only replaces its close handler. */
export function pushBack(id: string, close: () => BackResult): void {
  if (!listening && typeof window !== 'undefined') {
    window.addEventListener('popstate', onPop);
    listening = true;
  }
  const known = stack.find((e) => e.id === id);
  if (known) {
    known.close = close;
    return;
  }
  stack.push({ id, close });
  pushEntry(id);
}

/** The element closed by other means (button, route change): drop its entry. */
export function releaseBack(id: string): void {
  const index = stack.findIndex((e) => e.id === id);
  if (index < 0) return;
  stack.splice(index, 1);
  if (markerOnTop() === id) back();
}

/** Open elements that hold an entry (tests, diagnostics). */
export function backDepth(): number {
  return stack.length;
}

/** Test helper: forget everything and detach the listener. */
export function resetBackStack(): void {
  stack = [];
  swallow = 0;
  waiting = [];
  if (listening) window.removeEventListener('popstate', onPop);
  listening = false;
}
