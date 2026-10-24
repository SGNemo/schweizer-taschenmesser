// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setNow, now } from '@/core/time/now';
import {
  CACHE_KEY,
  cacheKey,
  clearCache,
  isFresh,
  readCache,
  TRIED_KEY,
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

  it('drops damaged or foreign stored values and removes the entry', () => {
    const bad: unknown[] = [
      '{not json',
      'null',
      '[]',
      42,
      { key, at: T0 },
      { key, at: '1', forecast },
      { key: 5, at: T0, forecast },
      { key, at: T0, forecast: { temp: '14', group: 'clear' } },
      { key, at: T0, forecast: { temp: 14, group: 'hail' } },
      { key, at: T0, forecast: { temp: 14, group: 'toString' } },
      { key, at: T0, forecast: { temp: 14, group: 'clear', rainFrom: 7 } },
      { key, at: null, forecast },
    ];
    for (const value of bad) {
      localStorage.setItem(CACHE_KEY, typeof value === 'string' ? value : JSON.stringify(value));
      expect(readCache()).toBeUndefined();
      expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    }
  });

  it('keeps a valid value with a rain hour and leaves it stored', () => {
    const c = { key, at: T0, forecast: { ...forecast, rainFrom: '15' } };
    writeCache(c);
    expect(readCache()).toEqual(c);
    expect(localStorage.getItem(CACHE_KEY)).not.toBeNull();
  });

  it('drops damaged or foreign `tm-weather-tried` values and removes the entry', () => {
    const bad: unknown[] = ['{oops', '"x"', { key }, { key, at: 'now' }, { key: 1, at: T0 }, []];
    for (const value of bad) {
      localStorage.setItem(TRIED_KEY, typeof value === 'string' ? value : JSON.stringify(value));
      expect(readTried()).toBeUndefined();
      expect(localStorage.getItem(TRIED_KEY)).toBeNull();
    }
    noteTried({ key, at: T0 });
    expect(readTried()).toEqual({ key, at: T0 });
  });

  it('does not touch the other entry when one is damaged', () => {
    noteTried({ key, at: T0 });
    localStorage.setItem(CACHE_KEY, '{x');
    expect(readCache()).toBeUndefined();
    expect(readTried()).toEqual({ key, at: T0 });
  });
});
