// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readHeadRoom, writeHeadRoom } from './headRoom';

describe('head room (U01)', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('remembers the height per route, rounded, and "empty" as 0', () => {
    expect(readHeadRoom('/invoices')).toBeUndefined();
    writeHeadRoom('/invoices', 4.37512);
    writeHeadRoom('/people', 0);
    expect(readHeadRoom('/invoices')).toBe(4.38);
    expect(readHeadRoom('/people')).toBe(0);
  });

  it('ignores values that are not a sane height', () => {
    localStorage.setItem('tm-head-room:/a', 'x');
    localStorage.setItem('tm-head-room:/b', '-1');
    localStorage.setItem('tm-head-room:/c', '400');
    expect(readHeadRoom('/a')).toBeUndefined();
    expect(readHeadRoom('/b')).toBeUndefined();
    expect(readHeadRoom('/c')).toBeUndefined();
  });

  it('blocked storage means "not known", never an error', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeHeadRoom('/invoices', 3)).not.toThrow();
    expect(readHeadRoom('/invoices')).toBeUndefined();
  });
});
