// @vitest-environment node
import { Worker as ThreadWorker } from 'node:worker_threads';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { startRun, type WorkerLike } from './run';
import type { RegexOutcome } from './logic';

afterEach(() => vi.useRealTimers());

const req = { pattern: 'a', flags: '', text: 'a' };

function fake(): WorkerLike & { terminate: Mock<() => void>; posted: unknown[] } {
  const posted: unknown[] = [];
  return {
    posted,
    onmessage: null,
    onerror: null,
    postMessage: (m) => void posted.push(m),
    terminate: vi.fn<() => void>(),
  };
}

describe('startRun (fake worker)', () => {
  it('hands the request to the worker and resolves with its answer, then terminates it', async () => {
    const w = fake();
    const run = startRun(req, () => w);
    expect(w.posted).toEqual([req]);
    const answer: RegexOutcome = { ok: true, hits: [], capped: false };
    w.onmessage?.({ data: answer });
    await expect(run.result).resolves.toBe(answer);
    expect(w.terminate).toHaveBeenCalledTimes(1);
  });

  it('terminates a worker that does not answer within the limit', async () => {
    vi.useFakeTimers();
    const w = fake();
    const run = startRun(req, () => w, 1000);
    vi.advanceTimersByTime(999);
    expect(w.terminate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    await expect(run.result).resolves.toEqual({ timeout: true });
    expect(w.terminate).toHaveBeenCalledTimes(1);
  });

  it('does not report a timeout after an answer, and cancel stops the worker', async () => {
    vi.useFakeTimers();
    const w = fake();
    const run = startRun(req, () => w, 1000);
    run.cancel();
    expect(w.terminate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(w.terminate).toHaveBeenCalledTimes(1);
  });

  it('turns a crashed worker into an error result', async () => {
    const w = fake();
    const run = startRun(req, () => w);
    w.onerror?.(new Error('boom'));
    await expect(run.result).resolves.toMatchObject({ ok: false });
  });
});

/** A real thread that runs a known catastrophic pattern: the page-side code must still get its answer. */
describe('startRun (real thread, catastrophic pattern)', () => {
  const code = `
    const { parentPort } = require('node:worker_threads');
    parentPort.on('message', (r) => {
      const m = new RegExp(r.pattern, r.flags).exec(r.text);
      parentPort.postMessage({ ok: true, hits: [], capped: false, replaced: String(m) });
    });`;
  const thread = (): WorkerLike => {
    const w = new ThreadWorker(code, { eval: true });
    const like: WorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage: (m) => w.postMessage(m),
      terminate: () => void w.terminate(),
    };
    w.on('message', (data: RegexOutcome) => like.onmessage?.({ data }));
    w.on('error', (e) => like.onerror?.(e));
    return like;
  };

  it('gives up after the limit instead of hanging, and a fine pattern still works', async () => {
    const t0 = Date.now();
    const bad = startRun({ pattern: '(a+)+$', flags: '', text: 'a'.repeat(60) + 'b' }, thread, 300);
    await expect(bad.result).resolves.toEqual({ timeout: true });
    expect(Date.now() - t0).toBeLessThan(2000);

    const good = startRun({ pattern: 'a+', flags: '', text: 'caat' }, thread, 2000);
    await expect(good.result).resolves.toMatchObject({ ok: true });
  });
});
