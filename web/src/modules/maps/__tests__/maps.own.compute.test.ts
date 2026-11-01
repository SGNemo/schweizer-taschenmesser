import { describe, expect, it, vi } from 'vitest';
import { inlineCompute, workerCompute, type WorkerLike } from '../own/compute';
import { handle, type BuildRequest, type BuildResult } from '../own/work';

/** A worker that answers on the next tick, like the real one, or fails on demand. */
function fakeWorker(fail = false) {
  const w: WorkerLike & { posted: BuildRequest[]; terminated: number } = {
    posted: [],
    terminated: 0,
    onmessage: null,
    onerror: null,
    postMessage(message) {
      this.posted.push(message);
      queueMicrotask(() => {
        if (fail) this.onerror?.(new Error('boom'));
        else this.onmessage?.({ data: handle(message) as BuildResult });
      });
    },
    terminate() {
      this.terminated++;
    },
  };
  return w;
}

const parent = (id: number): BuildRequest => ({
  kind: 'parent',
  id,
  parent: { z: 10, x: 1, y: 1 },
  children: [],
});

describe('compute', () => {
  it('inline: answers directly', async () => {
    expect(await inlineCompute().run(parent(1))).toEqual({ kind: 'parent', id: 1 });
  });

  it('worker: one worker for all requests, matched by id, terminated on dispose', async () => {
    const made: ReturnType<typeof fakeWorker>[] = [];
    const compute = workerCompute(() => {
      const w = fakeWorker();
      made.push(w);
      return w;
    });
    const [a, b] = await Promise.all([compute.run(parent(1)), compute.run(parent(2))]);
    expect(a).toEqual({ kind: 'parent', id: 1 });
    expect(b).toEqual({ kind: 'parent', id: 2 });
    expect(made).toHaveLength(1);
    expect(made[0]!.posted).toHaveLength(2);
    compute.dispose();
    expect(made[0]!.terminated).toBe(1);
    // After dispose a new request gets a new worker.
    await compute.run(parent(3));
    expect(made).toHaveLength(2);
  });

  it('worker: a crash rejects what is pending and the next request starts afresh', async () => {
    let fail = true;
    const make = vi.fn(() => fakeWorker(fail));
    const compute = workerCompute(make);
    await expect(compute.run(parent(1))).rejects.toThrow('boom');
    fail = false;
    expect(await compute.run(parent(2))).toEqual({ kind: 'parent', id: 2 });
    expect(make).toHaveBeenCalledTimes(2);
  });
});
