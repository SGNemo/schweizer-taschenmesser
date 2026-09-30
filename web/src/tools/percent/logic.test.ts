import { describe, expect, it } from 'vitest';
import { percentOf, shareOf, vat } from './logic';

describe('percent tool logic', () => {
  it('computes percentages and shares', () => {
    expect(percentOf(19, 240)).toBeCloseTo(45.6);
    expect(shareOf(30, 200)).toBe(15);
    expect(shareOf(1, 0)).toBeUndefined();
  });

  it('splits VAT from net and from gross, in cents', () => {
    expect(vat(100, 19, true)).toEqual({ net: 100, tax: 19, gross: 119 });
    expect(vat(119, 19, false)).toEqual({ net: 100, tax: 19, gross: 119 });
    expect(vat(9.99, 7, false)).toEqual({ net: 9.34, tax: 0.65, gross: 9.99 });
    expect(vat(0, 19, true)).toEqual({ net: 0, tax: 0, gross: 0 });
  });
});
