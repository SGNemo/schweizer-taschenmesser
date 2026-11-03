/**
 * Runs a job from `jobs.ts` in a Web Worker (one per job, ended when it is done or cancelled), with
 * progress. Without `Worker` (tests) or when it cannot start, the job runs inline. A cancelled job
 * rejects with an `AbortError`; nothing is written anywhere before the user confirms the preview,
 * so cancelling leaves no half state.
 */
import { JOBS, type JobName, type Jobs, type Progress } from './jobs';

export interface RunOptions {
  signal?: AbortSignal;
  onProgress?: Progress;
}

export const abortError = () => new DOMException('Import cancelled', 'AbortError');
export const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

function inline<K extends JobName>(
  name: K,
  input: Jobs[K]['in'],
  opts: RunOptions,
): Jobs[K]['out'] {
  if (opts.signal?.aborted) throw abortError();
  const out = JOBS[name](input, opts.onProgress ?? (() => {}));
  if (opts.signal?.aborted) throw abortError();
  return out;
}

let nextId = 1;

export function runJob<K extends JobName>(
  name: K,
  input: Jobs[K]['in'],
  opts: RunOptions = {},
): Promise<Jobs[K]['out']> {
  if (opts.signal?.aborted) return Promise.reject(abortError());
  if (typeof Worker === 'undefined') return Promise.resolve().then(() => inline(name, input, opts));
  let worker: Worker;
  try {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return Promise.resolve().then(() => inline(name, input, opts));
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const finish = () => {
      worker.terminate();
      opts.signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      finish();
      reject(abortError());
    };
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    worker.onmessage = (e: MessageEvent<{ id: number; type: string; [k: string]: unknown }>) => {
      if (e.data.id !== id) return;
      if (e.data.type === 'progress')
        opts.onProgress?.(e.data.done as number, e.data.total as number);
      else if (e.data.type === 'done') {
        finish();
        resolve(e.data.out as Jobs[K]['out']);
      } else {
        finish();
        reject(new Error(String(e.data.message)));
      }
    };
    // The Worker could not load (blocked, offline chunk): run inline instead of failing the import.
    worker.onerror = () => {
      finish();
      try {
        resolve(inline(name, input, opts));
      } catch (err) {
        reject(err);
      }
    };
    worker.postMessage({ id, name, input });
  });
}
