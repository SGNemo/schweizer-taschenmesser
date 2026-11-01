/**
 * Code that a start does not need, but that must work offline later (settings, library, weather dialog,
 * Argon2), is split off the critical path and loaded here right after the first render (next task, not
 * an idle slot: an idle slot can come too late when the device goes offline a second after the start),
 * all parts at once, errors ignored (a part then loads on use as before). With the service
 * worker these files come from the precache; without one (first visit, a blocked worker, Firefox private
 * mode) this keeps client-side navigation working offline. Numbers: docs/perf/COLD-START-2026-10.md.
 */
export type Loader = () => Promise<unknown>;

export interface IdleScheduler {
  idle(run: () => void): () => void;
}

const browserScheduler: IdleScheduler = {
  idle(run) {
    const id = setTimeout(run, 0);
    return () => clearTimeout(id);
  },
};

/** Starts every loader in the next task after the render; `done` when all settled. Returns cancel. */
export function preloadWhenIdle(
  loaders: readonly Loader[],
  scheduler: IdleScheduler = browserScheduler,
  done?: () => void,
): () => void {
  return scheduler.idle(() => {
    void Promise.allSettled(loaders.map((load) => load())).then(() => done?.());
  });
}
