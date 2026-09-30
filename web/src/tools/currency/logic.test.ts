import { describe, expect, it } from 'vitest';
import { convert, currencies, parseRates } from './logic';

const answer = {
  amount: 1,
  base: 'EUR',
  date: '2026-09-29',
  rates: { USD: 1.25, JPY: 160, CHF: 0.95 },
};

describe('currency logic', () => {
  it('reads the Frankfurter answer and adds EUR', () => {
    const r = parseRates(answer)!;
    expect(r.date).toBe('2026-09-29');
    expect(r.rates.EUR).toBe(1);
    expect(currencies(r)).toEqual(['CHF', 'EUR', 'JPY', 'USD']);
  });

  it('rejects malformed answers', () => {
    for (const bad of [
      null,
      {},
      { date: 'heute', rates: { USD: 1 } },
      { date: '2026-09-29', rates: {} },
      { date: '2026-09-29', rates: { USD: -1 } },
      'x',
    ])
      expect(parseRates(bad)).toBeUndefined();
  });

  it('converts through EUR in both directions', () => {
    const r = parseRates(answer)!;
    expect(convert(100, 'EUR', 'USD', r)).toBe(125);
    expect(convert(125, 'USD', 'EUR', r)).toBe(100);
    expect(convert(160, 'JPY', 'USD', r)).toBeCloseTo(1.25);
    expect(convert(1, 'EUR', 'XXX', r)).toBeUndefined();
  });
});
