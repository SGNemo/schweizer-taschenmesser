/**
 * Where the build's CPU work runs: in a Worker where the browser has one (the page stays smooth), inline
 * otherwise (tests, odd environments). One worker per build session, disposed when it ends.
 */
import { handle, transferables, type BuildRequest, type BuildResult } from './work';

export interface Compute {
  run(req: BuildRequest): Promise<BuildResult>;
  dispose(): void;
}

export function inlineCompute(): Compute {
  return {
    run: (req) => Promise.resolve(handle(req)),
    dispose: () => undefined,
  };
}

/** The slice of the Worker API this needs (tests pass a fake). */
export interface WorkerLike {
  postMessage(message: BuildRequest, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((e: { data: BuildResult }) => void) | null;
  onerror: ((e: unknown) => void) | null;
}

export function workerCompute(make: () => WorkerLike = makeBrowserWorker): Compute {
  let worker: WorkerLike | undefined;
  const pending = new Map<
    number,
    { resolve: (r: BuildResult) => void; reject: (e: unknown) => void }
  >();
  const ensure = (): WorkerLike => {
    if (worker) return worker;
    worker = make();
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      pending.delete(e.data.id);
      p?.resolve(e.data);
    };
    worker.onerror = (e) => {
      for (const p of pending.values()) p.reject(e);
      pending.clear();
      worker?.terminate();
      worker = undefined;
    };
    return worker;
  };
  return {
    run(req) {
      return new Promise<BuildResult>((resolve, reject) => {
        pending.set(req.id, { resolve, reject });
        const transfer =
          req.kind === 'cell'
            ? []
            : req.kind === 'parent'
              ? req.children.map((c) => c.bytes)
              : req.tiles.map((t) => t.bytes);
        ensure().postMessage(req, transfer);
      });
    },
    dispose() {
      worker?.terminate();
      worker = undefined;
      for (const p of pending.values()) p.reject(new Error('disposed'));
      pending.clear();
    },
  };
}

const makeBrowserWorker = (): WorkerLike =>
  new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;

/** A Worker where available, otherwise inline. */
export const defaultCompute = (): Compute =>
  typeof Worker === 'undefined' ? inlineCompute() : workerCompute();

/** Transferables of a request are consumed by the worker: callers must not reuse child buffers. */
export { transferables };
