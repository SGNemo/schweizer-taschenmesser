/**
 * Loads covers for the music module and keeps them for this session only: in memory, as `blob:` URLs, never in IndexedDB and never
 * on disk. One request per picture however many places show it, at most `MAX_PARALLEL` at a time, the least recently used ones are
 * dropped (and their `blob:` URL released) once nobody shows them. The fetch itself is handed in: it is the platform fetch of a
 * connected connector, so the connection log sees every request and "Netzwerk sperren" applies.
 */
import { isCoverUrl } from '@/core/connectors/coverUrl';
import { now } from '@/core/time/now';

export type CoverFetch = (url: string) => Promise<Response>;

export const MAX_PARALLEL = 4;
export const MAX_ENTRIES = 120;
export const MAX_BYTES = 16 * 1024 * 1024;
/** A single cover is a few hundred kB at most; anything far beyond is not shown. */
const MAX_COVER_BYTES = 4 * 1024 * 1024;
/** A picture that failed is not asked for again for a minute (a list of 200 rows must not retry in a loop). */
const RETRY_MS = 60_000;

interface Entry {
  blob: string;
  bytes: number;
  refs: number;
}
interface Job {
  url: string;
  fetch: CoverFetch;
  waiters: number;
  started: boolean;
  promise: Promise<Entry | undefined>;
  start: () => void;
}

/** Insertion order is the age: a used entry is re-inserted at the end. */
const cache = new Map<string, Entry>();
const jobs = new Map<string, Job>();
const queue: Job[] = [];
const failed = new Map<string, number>();
let running = 0;
let bytes = 0;

const revoke = (blob: string) => {
  try {
    URL.revokeObjectURL(blob);
  } catch {
    // Nothing to release.
  }
};

function trim(): void {
  if (cache.size <= MAX_ENTRIES && bytes <= MAX_BYTES) return;
  for (const [url, entry] of cache) {
    if (cache.size <= MAX_ENTRIES && bytes <= MAX_BYTES) break;
    // A picture that is on screen stays, however full the cache is.
    if (entry.refs > 0) continue;
    cache.delete(url);
    bytes -= entry.bytes;
    revoke(entry.blob);
  }
}

function pump(): void {
  while (running < MAX_PARALLEL && queue.length > 0) queue.shift()!.start();
}

async function load(job: Job): Promise<Entry | undefined> {
  try {
    const res = await job.fetch(job.url);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/') || blob.size === 0 || blob.size > MAX_COVER_BYTES)
      return undefined;
    const entry: Entry = { blob: URL.createObjectURL(blob), bytes: blob.size, refs: 0 };
    cache.set(job.url, entry);
    bytes += entry.bytes;
    return entry;
  } catch {
    return undefined;
  }
}

function enqueue(fetch: CoverFetch, url: string): Job {
  let resolve!: (entry: Entry | undefined) => void;
  const job: Job = {
    url,
    fetch,
    waiters: 0,
    started: false,
    promise: new Promise((r) => (resolve = r)),
    start: () => {
      job.started = true;
      running += 1;
      void load(job).then((entry) => {
        running -= 1;
        jobs.delete(url);
        if (!entry) failed.set(url, now());
        resolve(entry);
        pump();
        // After the views that waited have claimed it (their callbacks were registered first): a picture nobody waited for to
        // the end stays as an unused one and ages out like any other.
        void job.promise.then(trim);
      });
    },
  };
  jobs.set(url, job);
  queue.push(job);
  return job;
}

export interface CoverHandle {
  /** The `blob:` URL, or `undefined` when there is no picture (wrong host, failure, released before it started). */
  promise: Promise<string | undefined>;
  /** Call once when the picture leaves the screen for good; its `blob:` URL may be released afterwards. */
  release(): void;
}

const NONE: CoverHandle = { promise: Promise.resolve(undefined), release: () => undefined };

/** The cover that is already in memory (no request, no claim on it). */
export function peekCover(url: string | undefined): string | undefined {
  return url ? cache.get(url)?.blob : undefined;
}

export function acquireCover(fetch: CoverFetch, url: string): CoverHandle {
  if (!isCoverUrl(url) || typeof URL.createObjectURL !== 'function') return NONE;
  let held: Entry | undefined;
  let released = false;
  const hold = (entry: Entry | undefined): string | undefined => {
    // Dropped from memory in the meantime (cleared on disconnect): its blob URL is gone.
    if (!entry || released || cache.get(url) !== entry) return undefined;
    held = entry;
    entry.refs += 1;
    return entry.blob;
  };
  const release = () => {
    if (released) return;
    released = true;
    if (held) {
      held.refs -= 1;
      // Evicted while it was on screen: nobody else can reach it, so release it now.
      if (held.refs === 0 && cache.get(url) !== held) revoke(held.blob);
      trim();
    }
  };

  const hit = cache.get(url);
  if (hit) {
    cache.delete(url);
    cache.set(url, hit);
    return { promise: Promise.resolve(hold(hit)), release };
  }
  const failedAt = failed.get(url);
  if (failedAt !== undefined && now() - failedAt < RETRY_MS) return NONE;
  failed.delete(url);

  const job = jobs.get(url) ?? enqueue(fetch, url);
  job.waiters += 1;
  const promise = job.promise.then(hold);
  pump();
  return {
    promise,
    release: () => {
      if (released) return;
      job.waiters -= 1;
      // Scrolled past before its turn: the request is never made.
      if (job.waiters === 0 && !job.started) {
        const at = queue.indexOf(job);
        if (at >= 0) queue.splice(at, 1);
        jobs.delete(url);
      }
      release();
    },
  };
}

/**
 * Drops every cover in memory (disconnect, tests). Pictures still on screen are released when their view lets go; requests a view
 * still waits for go on.
 */
export function clearCovers(): void {
  for (const [url, entry] of cache) {
    cache.delete(url);
    if (entry.refs === 0) revoke(entry.blob);
  }
  bytes = 0;
  failed.clear();
}

/** For tests. */
export const coverStats = () => ({ entries: cache.size, bytes, running, queued: queue.length });
