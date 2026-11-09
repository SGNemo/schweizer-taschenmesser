// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFigureRoom, writeFigureRoom } from './figureRoom';

describe('figure room (U01)', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('remembers the height per route, rounded, and "no figure" as 0', () => {
    expect(readFigureRoom('/invoices')).toBeUndefined();
    writeFigureRoom('/invoices', 4.37512);
    writeFigureRoom('/people', 0);
    expect(readFigureRoom('/invoices')).toBe(4.38);
    expect(readFigureRoom('/people')).toBe(0);
  });

  it('ignores values that are not a sane height', () => {
    localStorage.setItem('tm-head-figure:/a', 'x');
    localStorage.setItem('tm-head-figure:/b', '-1');
    localStorage.setItem('tm-head-figure:/c', '400');
    expect(readFigureRoom('/a')).toBeUndefined();
    expect(readFigureRoom('/b')).toBeUndefined();
    expect(readFigureRoom('/c')).toBeUndefined();
  });

  it('blocked storage means "not known", never an error', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeFigureRoom('/invoices', 3)).not.toThrow();
    expect(readFigureRoom('/invoices')).toBeUndefined();
  });
});
