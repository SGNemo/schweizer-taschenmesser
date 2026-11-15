/**
 * Wrong-PIN wait (localStorage `tm-app-lock-fails`, device-local): after 5 wrong tries a wait of
 * 30 s, doubling with every further wrong try, at most 15 min. A correct PIN resets it; the wait
 * survives a reload.
 */
import { z } from 'zod';
import { now } from '@/core/time/now';

export const FAILS_KEY = 'tm-app-lock-fails';
export const FREE_TRIES = 5;
export const FIRST_WAIT_MS = 30_000;
export const MAX_WAIT_MS = 15 * 60_000;

const schema = z.object({
  count: z.number().int().min(0).catch(0),
  until: z.number().min(0).catch(0),
});
type Fails = z.infer<typeof schema>;

function read(): Fails {
  try {
    const raw = localStorage.getItem(FAILS_KEY);
    return schema.parse(raw ? JSON.parse(raw) : {});
  } catch {
    return { count: 0, until: 0 };
  }
}

function write(f: Fails): void {
  try {
    localStorage.setItem(FAILS_KEY, JSON.stringify(f));
  } catch {
    // storage blocked: the wait only lasts as long as this page
  }
}

/** The wait after `count` wrong tries (0 while the free tries last). */
export function waitFor(count: number): number {
  if (count < FREE_TRIES) return 0;
  return Math.min(FIRST_WAIT_MS * 2 ** (count - FREE_TRIES), MAX_WAIT_MS);
}

/** Milliseconds until the next try is allowed (0 = now). */
export function waitRemaining(): number {
  return Math.max(0, read().until - now());
}

export function recordFail(): void {
  const count = read().count + 1;
  const wait = waitFor(count);
  write({ count, until: wait > 0 ? now() + wait : 0 });
}

export function resetFails(): void {
  try {
    localStorage.removeItem(FAILS_KEY);
  } catch {
    // nothing stored
  }
}
