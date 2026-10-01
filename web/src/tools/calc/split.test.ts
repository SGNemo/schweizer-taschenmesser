import { describe, expect, it } from 'vitest';
import { splitBill } from './split';

describe('splitBill', () => {
  it('splits with tip', () => {
    expect(splitBill(90, 3, 10, false)).toEqual({ tip: 9, sum: 99, perPerson: 33 });
  });
  it('rounds each share up and reports the resulting sum', () => {
    expect(splitBill(50, 3, 0, true)).toEqual({ tip: 0, sum: 51, perPerson: 17 });
  });
  it('does not round up an exact share', () => {
    expect(splitBill(99, 3, 0, true)?.perPerson).toBe(33);
  });
  it('validates input', () => {
    expect(splitBill(-1, 2, 0, false)).toBeUndefined();
    expect(splitBill(10, 0, 0, false)).toBeUndefined();
    expect(splitBill(10, 1.5, 0, false)).toBeUndefined();
    expect(splitBill(10, 2, -5, false)).toBeUndefined();
  });
});
