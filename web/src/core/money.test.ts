import { describe, expect, it } from 'vitest';
import {
  currencyOf,
  formatMoney,
  formatMoneyAxis,
  formatMoneyInput,
  formatTotals,
  isCurrencyCode,
  parseMoney,
  sumByCurrency,
  sumMinor,
} from './money';

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

describe('currencies', () => {
  it('knows valid ISO codes and falls back to the euro', () => {
    expect(isCurrencyCode('MXN')).toBe(true);
    expect(isCurrencyCode('mxn')).toBe(false);
    expect(isCurrencyCode('EURO')).toBe(false);
    expect(isCurrencyCode('ZZZ')).toBe(false);
    expect(currencyOf(undefined)).toBe('EUR');
    expect(currencyOf({ currency: 'USD' })).toBe('USD');
    expect(currencyOf({ currency: 'nonsense' })).toBe('EUR');
    expect(currencyOf(null)).toBe('EUR');
  });

  it('formats in the given currency and never converts', () => {
    expect(formatMoney(1234, 'USD')).toMatch(/12[.,]34/);
    expect(formatMoney(1234, 'USD')).toMatch(/\$|USD/);
    expect(formatMoney(1234)).toContain('€');
  });

  it('sums per currency, the euro first, and writes them side by side', () => {
    const totals = sumByCurrency([
      { amountMinor: 100, currency: 'MXN' },
      { amountMinor: 250 },
      { amountMinor: 50, currency: 'EUR' },
      { amountMinor: 900, currency: 'MXN' },
    ]);
    expect([...totals]).toEqual([
      ['EUR', 300],
      ['MXN', 1000],
    ]);
    expect(formatTotals(totals)).toContain(' · ');
    expect(formatTotals(new Map())).toContain('€');
  });

  it('parses an amount typed with a currency symbol', () => {
    expect(parseMoney('$12,50')).toBe(1250);
    expect(parseMoney('12.50 £')).toBe(1250);
  });
});
