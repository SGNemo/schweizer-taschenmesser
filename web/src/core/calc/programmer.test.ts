import { describe, expect, it } from 'vitest';
import {
  baseConversion,
  parseLiteral,
  readWord,
  toInteger,
  toWord,
  viewInteger,
} from './programmer';

describe('words', () => {
  it('wraps to the word size (two’s complement)', () => {
    expect(toWord(-1n, 8)).toBe(255n);
    expect(toWord(256n, 8)).toBe(0n);
    expect(toWord(-6n, 8)).toBe(250n);
    expect(toWord(-1n, 64)).toBe(18446744073709551615n);
  });
  it('reads signed and unsigned', () => {
    expect(readWord(250n, 8, true)).toBe(-6n);
    expect(readWord(250n, 8, false)).toBe(250n);
    expect(readWord(127n, 8, true)).toBe(127n);
    expect(readWord(128n, 8, true)).toBe(-128n);
  });
});

describe('viewInteger', () => {
  it('shows all four bases', () => {
    expect(viewInteger(31n, 8, true)).toEqual({
      hex: '1F',
      dec: '31',
      oct: '37',
      bin: '0001 1111',
      fits: true,
    });
  });
  it('wraps negatives and reports overflow', () => {
    const v = viewInteger(-6n, 8, true);
    expect(v.hex).toBe('FA');
    expect(v.dec).toBe('-6');
    expect(v.fits).toBe(true);
    expect(viewInteger(300n, 8, false).fits).toBe(false);
    expect(viewInteger(128n, 8, true).fits).toBe(false);
    expect(viewInteger(2n ** 63n, 64, false).hex).toBe('8000 0000 0000 0000');
  });
});

describe('toInteger', () => {
  it('accepts integers only', () => {
    expect(toInteger('255')).toBe(255n);
    expect(toInteger('-6')).toBe(-6n);
    expect(toInteger('1e+3')).toBe(1000n);
    expect(toInteger('1.5')).toBeUndefined();
    expect(toInteger('5 inch')).toBeUndefined();
  });
});

describe('baseConversion', () => {
  it.each([
    ['0x1F in dez', '31'],
    ['0x1F to dec', '31'],
    ['255 in hex', '0xFF'],
    ['255 in bin', '0b11111111'],
    ['0b1010 in oktal', '0o12'],
    ['-16 in hex', '-0x10'],
    ['=0xFF in dez', '255'],
  ])('%s → %s', (q, copy) => {
    expect(baseConversion(q)?.copy).toBe(copy);
  });
  it('ignores everything else', () => {
    expect(baseConversion('12 cm in zoll')).toBeUndefined();
    expect(baseConversion('0xZZ in dez')).toBeUndefined();
    expect(parseLiteral('1_000')).toBe(1000n);
  });
});
