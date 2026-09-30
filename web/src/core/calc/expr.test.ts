import { describe, expect, it } from 'vitest';
import { CalcError, evaluate, formatNumber } from './expr';
import { calculate, looksLikeCalculation } from './phrases';

const code = (input: string) => {
  try {
    evaluate(input);
    return undefined;
  } catch (e) {
    return e instanceof CalcError ? e.code : 'other';
  }
};

describe('evaluate', () => {
  it('does arithmetic with the usual precedence and parentheses', () => {
    expect(evaluate('1+2*3')).toBe(7);
    expect(evaluate('(1+2)*3')).toBe(9);
    expect(evaluate('2^3^2')).toBe(512); // right associative
    expect(evaluate('-2^2')).toBe(-4);
    expect(evaluate('2^-1')).toBe(0.5);
    expect(evaluate('10/4')).toBe(2.5);
    expect(evaluate('2*-3')).toBe(-6);
    expect(evaluate('--4')).toBe(4);
  });

  it('reads German and English number notation', () => {
    expect(evaluate('12,5*2')).toBe(25);
    expect(evaluate('12.5*2')).toBe(25);
    expect(evaluate('1.234,56+0,44')).toBe(1235);
    expect(evaluate('1.234.567,5')).toBe(1234567.5);
    expect(evaluate(',5+.5')).toBe(1);
    expect(evaluate('1.000+1')).toBe(1001);
    expect(evaluate('0.123*1000')).toBe(123);
    expect(evaluate('1 000+1')).toBe(1001); // a space as thousands separator
  });

  it('accepts the usual operator symbols and words', () => {
    expect(evaluate('6×7')).toBe(42);
    expect(evaluate('84÷2')).toBe(42);
    expect(evaluate('84:2')).toBe(42);
    expect(evaluate('50−8')).toBe(42);
    expect(evaluate('sqrt(81)+wurzel(16)')).toBe(13);
    expect(evaluate('2*pi')).toBeCloseTo(6.283185307, 8);
  });

  it('treats percent relative to the left side in sums and as a fraction elsewhere', () => {
    expect(evaluate('240+19%')).toBe(285.6);
    expect(evaluate('240-19%')).toBe(194.4);
    expect(evaluate('240*19%')).toBe(45.6);
    expect(evaluate('50%')).toBe(0.5);
    expect(evaluate('200*(10+5%)')).toBe(2100);
  });

  it('removes floating point noise', () => {
    expect(evaluate('0,1+0,2')).toBe(0.3);
    expect(evaluate('1/3*3')).toBe(1);
  });

  it('reports errors instead of guessing', () => {
    expect(code('1/0')).toBe('divide-by-zero');
    expect(code('')).toBe('empty');
    expect(code('   ')).toBe('empty');
    expect(code('1+')).toBe('syntax');
    expect(code('(1+2')).toBe('syntax');
    expect(code('abc')).toBe('syntax');
    expect(code('sqrt(-1)')).toBe('range');
    expect(code('9^9^9')).toBe('range');
    expect(code('1'.repeat(300))).toBe('syntax');
  });

  it('never executes anything', () => {
    for (const evil of [
      'alert(1)',
      'constructor',
      '__proto__',
      'process.exit()',
      '1;2',
      '`x`',
      'this',
      '1+globalThis',
    ])
      expect(code(evil), evil).toBe('syntax');
  });
});

describe('formatNumber', () => {
  it('uses German separators', () => {
    expect(formatNumber(1234.5)).toBe('1.234,5');
    expect(formatNumber(0.3333333333)).toBe('0,333333');
  });
});

describe('calculator phrases', () => {
  it('recognises arithmetic and leaves search terms alone', () => {
    for (const ok of [
      '12*3,5',
      '240 + 19%',
      '(3+4)*2',
      'sqrt(16)',
      '19% von 240',
      '30 von 200 in prozent',
    ])
      expect(looksLikeCalculation(ok), ok).toBe(true);
    for (const no of [
      'miete',
      '5',
      '29.09.2026',
      '12,50',
      'rechnung 2026',
      'was kostet 5 euro',
      '',
      '-3',
    ])
      expect(looksLikeCalculation(no), no).toBe(false);
  });

  it('answers with text and a copyable value', () => {
    expect(calculate('12*3,5')).toEqual({ value: 42, text: '12*3,5 = 42' });
    expect(calculate('240 + 19%')).toMatchObject({ value: 285.6 });
    expect(calculate('19% von 240')).toEqual({ value: 45.6, text: '19% von 240 = 45,6' });
    expect(calculate('19 prozent von 1.000')).toMatchObject({ value: 190 });
    expect(calculate('30 von 200 in prozent')).toEqual({ value: 15, text: '30 von 200 = 15%' });
  });

  it('gives no answer for errors', () => {
    expect(calculate('1/0')).toBeUndefined();
    expect(calculate('5 von 0 in prozent')).toBeUndefined();
    expect(calculate('miete')).toBeUndefined();
  });
});
