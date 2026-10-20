// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setNow, now } from '@/core/time/now';
import {
  CACHE_KEY,
  cacheKey,
  clearCache,
  isFresh,
  readCache,
  shouldFetch,
  noteTried,
  readTried,
  WEATHER_RETRY_MS,
  WEATHER_TTL_MS,
  writeCache,
} from './cache';

const T0 = Date.UTC(2026, 9, 19, 10, 0, 0);
const forecast = { temp: 14, group: 'clear' as const };
const key = cacheKey(46.95, 7.45);

beforeEach(() => {
  localStorage.clear();
  setNow(() => T0);
});
afterEach(() => setNow());

describe('forecast cache (fixed clock)', () => {
  it('round-trips through localStorage `tm-weather` and clears', () => {
    expect(readCache()).toBeUndefined();
    writeCache({ key, at: now(), forecast });
    expect(localStorage.getItem(CACHE_KEY)).toContain('"temp":14');
    expect(readCache()).toEqual({ key, at: T0, forecast });
    clearCache();
    expect(readCache()).toBeUndefined();
  });

  it('ignores damaged content', () => {
    localStorage.setItem(CACHE_KEY, '{not json');
    expect(readCache()).toBeUndefined();
    localStorage.setItem(CACHE_KEY, JSON.stringify({ key, forecast }));
    expect(readCache()).toBeUndefined();
  });

  it('is fresh for 30 minutes and only for the same place', () => {
    const c = { key, at: T0, forecast };
    expect(isFresh(c, key, T0 + WEATHER_TTL_MS - 1)).toBe(true);
    expect(isFresh(c, key, T0 + WEATHER_TTL_MS)).toBe(false);
    expect(isFresh(c, cacheKey(51.1, 9), T0)).toBe(false);
    expect(isFresh(undefined, key, T0)).toBe(false);
  });

  it('asks at most once per 30 minutes and never while offline', () => {
    const c = { key, at: T0, forecast };
    expect(shouldFetch(undefined, key, T0, true)).toBe(true);
    expect(shouldFetch(c, key, T0 + 60_000, true)).toBe(false);
    expect(shouldFetch(c, key, T0 + WEATHER_TTL_MS, true)).toBe(true);
    expect(shouldFetch(c, key, T0 + WEATHER_TTL_MS, false)).toBe(false);
    expect(shouldFetch(undefined, key, T0, false)).toBe(false);
  });

  it('waits a few minutes after a failed request, per place, and forgets it with the cache', () => {
    noteTried({ key, at: T0 });
    expect(readTried()).toEqual({ key, at: T0 });
    expect(shouldFetch(undefined, key, T0 + 60_000, true, readTried())).toBe(false);
    expect(shouldFetch(undefined, key, T0 + WEATHER_RETRY_MS, true, readTried())).toBe(true);
    expect(shouldFetch(undefined, cacheKey(51.1, 9), T0 + 60_000, true, readTried())).toBe(true);
    clearCache();
    expect(readTried()).toBeUndefined();
  });
});
