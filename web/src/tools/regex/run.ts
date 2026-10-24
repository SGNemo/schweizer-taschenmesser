import { TIMEOUT_MS, type RegexOutcome, type RegexRequest } from './logic';

export type RunResult = RegexOutcome | { timeout: true };

/** The slice of the Worker API this file needs (a fake or a thread adapter in tests). */
export interface WorkerLike {
  postMessage(message: RegexRequest): void;
  terminate(): void;
  onmessage: ((e: { data: RegexOutcome }) => void) | null;
  onerror: ((e: unknown) => void) | null;
}

export interface Run {
  result: Promise<RunResult>;
  /** Stops the work now (a newer input replaced it). The promise then never settles. */
  cancel(): void;
}

/**
 * One worker per run: a pattern that never ends only costs a worker that is terminated after `limitMs`.
 * Nothing user-supplied runs on the page itself.
 */
export function startRun(
  req: RegexRequest,
  makeWorker: () => WorkerLike,
  limitMs: number = TIMEOUT_MS,
): Run {
  const worker = makeWorker();
  let done = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    done = true;
    clearTimeout(timer);
    worker.terminate();
  };
  const result = new Promise<RunResult>((resolve) => {
    worker.onmessage = (e) => {
      if (done) return;
      finish();
      resolve(e.data);
    };
    worker.onerror = () => {
      if (done) return;
      finish();
      resolve({ ok: false, error: '' });
    };
    timer = setTimeout(() => {
      if (done) return;
      finish();
      resolve({ timeout: true });
    }, limitMs);
    worker.postMessage(req);
  });
  return {
    result,
    cancel: () => {
      if (!done) finish();
    },
  };
}

export const workerSupported = (): boolean => typeof Worker !== 'undefined';

/** The real worker (Vite bundles it as its own chunk). */
export const makeBrowserWorker = (): WorkerLike =>
  new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;

export const runInBrowser = (req: RegexRequest): Run => startRun(req, makeBrowserWorker);
