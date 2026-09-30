import { describe, expect, it } from 'vitest';
import { formatMoney, formatMoneyAxis, formatMoneyInput, parseMoney, sumMinor } from './money';

describe('parseMoney', () => {
  it.each([
    ['12', 1200],
    ['12,5', 1250],
    ['12,50', 1250],
    ['12.5', 1250],
    ['12.50', 1250],
    ['0,99', 99],
    ['1.234,56', 123456],
    ['1.234', 123400],
    ['1.234.567,8', 123456780],
    ['1234.56', 123456],
    ['  12,50 € ', 1250],
    ['0', 0],
  ])('parses %s', (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it.each(['', 'abc', '12,345', '1,2,3', '12,5x', '--5', ',5', '1e3'])('rejects %s', (input) => {
    expect(parseMoney(input)).toBeUndefined();
  });

  it('only accepts negatives when allowed', () => {
    expect(parseMoney('-5,50')).toBeUndefined();
    expect(parseMoney('-5,50', { allowNegative: true })).toBe(-550);
  });
});

describe('formatting', () => {
  it('formats euros the German way', () => {
    expect(formatMoney(123456).replace(/\s/g, ' ')).toBe('1.234,56 €');
    expect(formatMoney(-500).replace(/\s/g, ' ')).toBe('-5,00 €');
    expect(formatMoneyAxis(120000)).toBe('1.200');
  });

  it('round-trips through the input format', () => {
    expect(formatMoneyInput(123456)).toBe('1234,56');
    for (const v of [0, 5, 99, 100, 123456, 100000000]) {
      expect(parseMoney(formatMoneyInput(v))).toBe(v);
    }
  });

  it('sums minor units exactly', () => {
    expect(sumMinor([10, 20, 30])).toBe(60);
    expect(sumMinor([])).toBe(0);
  });
});
