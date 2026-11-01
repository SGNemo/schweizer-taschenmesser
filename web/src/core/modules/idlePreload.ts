/**
 * Code that a start does not need, but that must work offline later (settings, library, weather dialog,
 * Argon2), is split off the critical path and loaded here in the first idle slot after the start (not
 * right after the render: that cost the phone profile ~0.7 s to the capture field), all parts at once,
 * errors ignored (a part then loads on use as before). With the service
 * worker these files come from the precache; without one (first visit, a blocked worker, Firefox private
 * mode) this keeps client-side navigation working offline. Numbers: docs/perf/COLD-START-2026-10.md.
 */
export type Loader = () => Promise<unknown>;

export interface IdleScheduler {
  idle(run: () => void): () => void;
}

const browserScheduler: IdleScheduler = {
  idle(run) {
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(run, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(run, 500);
    return () => clearTimeout(id);
  },
};

/** Starts every loader in the next idle slot; `done` when all settled. Returns cancel. */
export function preloadWhenIdle(
  loaders: readonly Loader[],
  scheduler: IdleScheduler = browserScheduler,
  done?: () => void,
): () => void {
  return scheduler.idle(() => {
    void Promise.allSettled(loaders.map((load) => load())).then(() => done?.());
  });
}
