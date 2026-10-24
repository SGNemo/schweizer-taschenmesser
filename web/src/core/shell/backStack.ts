/**
 * "Back" closes what is open first (Android back gesture, browser back button): every open
 * dialog, row menu or sheet registers here and gets one history entry with a marker. A `popstate`
 * closes the topmost one instead of leaving the page. Pure logic over `window.history`; the React
 * side is `useBackClose`.
 *
 * - One entry per element (by id): registering twice adds nothing.
 * - Closing with a button releases the entry; `history.back()` only runs when our entry is on
 *   top (marker, or replaced in place by the router), and the resulting `popstate` is swallowed (it is ours).
 * - A close handler may answer `'keep'` ("discard the draft?" is shown): the entry is put back.
 * - A marker entry left behind (the router moved on while a menu was open) is skipped on the way
 *   back, so one press never lands on a page that looks unchanged.
 */
export type BackResult = void | 'keep';

interface Entry {
  id: string;
  close: () => BackResult;
  /** The router's position (`history.state.idx`) when our entry was pushed. */
  idx?: unknown;
}

const MARK = 'tmBack';

let stack: Entry[] = [];
/** `history.back()` calls of ours whose `popstate` has not arrived yet. */
let swallow = 0;
/** Pushes that wait until our own `history.back()` has settled (a push in between would be undone). */
let waiting: Array<() => void> = [];
let listening = false;
/** The router replaced our entry in place (`?new=1` dropped on close): put that state back after our `back()`. */
let restore: { state: unknown; url: string } | null = null;
/** Our own re-announcement of the restored location; not a user's Back. */
let announcing = false;

function markerOnTop(): string | undefined {
  const state = history.state as Record<string, unknown> | null;
  const id = state?.[MARK];
  return typeof id === 'string' ? id : undefined;
}

function stateIdx(): unknown {
  return (history.state as Record<string, unknown> | null)?.idx;
}

/**
 * Our entry is still the top one: the marker is there, or the router replaced the entry in place
 * (a `replace` keeps its `idx`; a push moves on to the next one).
 */
function ownsTop(entry: Entry): boolean {
  const marker = markerOnTop();
  return marker === entry.id || (marker === undefined && stateIdx() === entry.idx);
}

function pushEntry(entry: Entry): void {
  const run = () => {
    history.pushState({ ...(history.state ?? {}), [MARK]: entry.id }, '');
    entry.idx = stateIdx();
  };
  if (swallow > 0) waiting.push(run);
  else run();
}

function back(): void {
  swallow += 1;
  history.back();
}

function onPop(): void {
  if (announcing) return;
  if (swallow > 0) {
    swallow -= 1;
    if (swallow === 0) {
      if (restore) {
        // We landed on the entry below ours (still showing `?new=1`); it takes over what the
        // router had made of ours, and the router is told once more so it reads the URL again.
        history.replaceState(restore.state, '', restore.url);
        restore = null;
        announcing = true;
        window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
        announcing = false;
      }
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
    pushEntry(top);
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
  const entry: Entry = { id, close };
  stack.push(entry);
  pushEntry(entry);
}

/** The element closed by other means (button, route change): drop its entry. */
export function releaseBack(id: string): void {
  const index = stack.findIndex((e) => e.id === id);
  if (index < 0) return;
  const [entry] = stack.splice(index, 1);
  if (!entry || !ownsTop(entry)) return;
  if (markerOnTop() === undefined) restore = { state: history.state, url: location.href };
  back();
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
  restore = null;
  announcing = false;
  if (listening) window.removeEventListener('popstate', onPop);
  listening = false;
}
