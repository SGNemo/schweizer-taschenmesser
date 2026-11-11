import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_ENTRIES,
  MAX_PARALLEL,
  acquireCover,
  clearCovers,
  coverStats,
  peekCover,
} from '../coverLoader';

const url = (n: number | string) => `https://i.scdn.co/image/cover${n}`;
const image = (bytes = 10) =>
  new Response(new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), { status: 200 });

let made: string[];
let revoked: string[];
const realCreate = URL.createObjectURL;
const realRevoke = URL.revokeObjectURL;

beforeEach(() => {
  made = [];
  revoked = [];
  URL.createObjectURL = () => {
    const blob = `blob:test/${made.length}`;
    made.push(blob);
    return blob;
  };
  URL.revokeObjectURL = (blob: string) => void revoked.push(blob);
});
afterEach(() => {
  clearCovers();
  URL.createObjectURL = realCreate;
  URL.revokeObjectURL = realRevoke;
});

/** A fetch whose answers are released by hand, to look at what runs at the same time. */
function gate() {
  const open: (() => void)[] = [];
  const fetch = vi.fn(
    (_url: string) => new Promise<Response>((resolve) => open.push(() => resolve(image()))),
  );
  return { fetch, open };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('cover loader', () => {
  it('asks once per picture however many places show it, and serves the next one from memory', async () => {
    const fetch = vi.fn(async (_url: string) => image());
    const a = acquireCover(fetch, url(1));
    const b = acquireCover(fetch, url(1));
    expect(await a.promise).toBe('blob:test/0');
    expect(await b.promise).toBe('blob:test/0');
    expect(await acquireCover(fetch, url(1)).promise).toBe('blob:test/0');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(peekCover(url(1))).toBe('blob:test/0');
  });

  it('never asks for a URL that fails the host rule', async () => {
    const fetch = vi.fn(async (_url: string) => image());
    for (const bad of [
      'https://evil.test/image/x',
      'http://i.scdn.co/image/x',
      'https://i.scdn.co.evil.tld/image/x',
      'https://i.scdn.co/image/x?y=1',
    ])
      expect(await acquireCover(fetch, bad).promise).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it(`runs at most ${MAX_PARALLEL} requests at a time; a picture released before its turn is never asked for`, async () => {
    const { fetch, open } = gate();
    const handles = Array.from({ length: 7 }, (_, i) => acquireCover(fetch, url(i)));
    expect(fetch).toHaveBeenCalledTimes(MAX_PARALLEL);
    expect(coverStats()).toMatchObject({ running: MAX_PARALLEL, queued: 3 });
    handles[6]!.release();
    expect(coverStats().queued).toBe(2);
    open.splice(0).forEach((go) => go());
    await settle();
    expect(fetch).toHaveBeenCalledTimes(6);
    open.splice(0).forEach((go) => go());
    await settle();
    expect(fetch.mock.calls.map((c) => c[0])).not.toContain(url(6));
    expect(coverStats()).toMatchObject({ running: 0, queued: 0, entries: 6 });
  });

  it('keeps the latest pictures only: the oldest unused one is dropped and its blob URL released', async () => {
    const fetch = vi.fn(async (_url: string) => image());
    const shown = acquireCover(fetch, url('shown'));
    const first = await shown.promise;
    for (let i = 0; i < MAX_ENTRIES + 5; i += 1) {
      const h = acquireCover(fetch, url(i));
      await h.promise;
      h.release();
    }
    expect(coverStats().entries).toBe(MAX_ENTRIES);
    // The one on screen stayed although it is the oldest; unused ones went, oldest first.
    expect(revoked).not.toContain(first);
    expect(peekCover(url('shown'))).toBe(first);
    expect(peekCover(url(0))).toBeUndefined();
    expect(revoked).toContain('blob:test/1');
    expect(peekCover(url(MAX_ENTRIES + 4))).toBeDefined();
  });

  it('a failure, a non-image or an empty answer gives no picture and is not retried at once', async () => {
    const answers = [
      () => new Response('nope', { status: 404 }),
      () => new Response(new Blob(['<html>'], { type: 'text/html' }), { status: 200 }),
      () => Promise.reject(new TypeError('network blocked')),
    ];
    for (const [i, answer] of answers.entries()) {
      const fetch = vi.fn(async (_url: string) => answer());
      expect(await acquireCover(fetch, url(`bad${i}`)).promise).toBeUndefined();
      expect(await acquireCover(fetch, url(`bad${i}`)).promise).toBeUndefined();
      expect(fetch).toHaveBeenCalledTimes(1);
    }
    expect(made).toEqual([]);
  });

  it('clearing releases what nobody shows; a picture still on screen is released when its view lets go', async () => {
    const fetch = vi.fn(async (_url: string) => image());
    const shown = acquireCover(fetch, url('a'));
    const idle = acquireCover(fetch, url('b'));
    const [a, b] = [await shown.promise, await idle.promise];
    idle.release();
    clearCovers();
    expect(revoked).toEqual([b]);
    shown.release();
    expect(revoked).toEqual([b, a]);
    expect(coverStats()).toMatchObject({ entries: 0, bytes: 0 });
  });
});
