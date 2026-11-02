import { describe, expect, it } from 'vitest';
import { calculate, calculateExpression } from './phrases';

describe('calculate (synchronous palette answers)', () => {
  it('keeps the arithmetic and percent phrases', () => {
    expect(calculate('240 + 19%')).toEqual({ text: '240 + 19% = 285,6', copy: '285,6' });
    expect(calculate('19% von 240')?.copy).toBe('45,6');
    expect(calculate('30 von 200 in prozent')?.copy).toBe('15');
    expect(calculate('2026')).toBeUndefined();
    expect(calculate('29.09.2026')).toBeUndefined();
  });
  it('converts number bases', () => {
    expect(calculate('0x1F in dez')?.copy).toBe('31');
    expect(calculate('255 in hex')?.copy).toBe('0xFF');
  });
  it('adds to dates', () => {
    const a = calculate('01.01.2027 + 45 Tage');
    expect(a?.copy).toBe('2027-02-15');
    expect(a?.text).toContain('01.01.2027 + 45 Tage = ');
    expect(calculate('01.01.2027 bis 31.01.2027')?.copy).toBe('30');
  });
});

describe('calculateExpression ("=" prefix)', () => {
  it('answers with the full engine', async () => {
    expect(await calculateExpression('=sqrt(2)*3')).toEqual({
      text: 'sqrt(2)*3 = 4,24264068711929',
      copy: '4,24264068711929',
    });
    expect(await calculateExpression('= 0,1 + 0,2')).toMatchObject({ copy: '0,3' });
    expect(await calculateExpression('=2^64')).toMatchObject({
      text: '2^64 = 18.446.744.073.709.600.000',
    });
    expect(await calculateExpression('=sin(30 deg)')).toMatchObject({ copy: '0,5' });
  });
  it('reuses the phrases', async () => {
    expect(await calculateExpression('=0x1F in dez')).toMatchObject({ copy: '31' });
    expect(await calculateExpression('=01.01.2027 + 1 Monat')).toMatchObject({
      copy: '2027-02-01',
    });
  });
  it('says what is wrong', async () => {
    expect(await calculateExpression('=2 +')).toHaveProperty('error');
    expect(await calculateExpression('=foo')).toHaveProperty('error');
  });
  it('ignores input without the prefix', async () => {
    expect(await calculateExpression('2+2')).toBeUndefined();
    expect(await calculateExpression('=')).toBeUndefined();
  });
});
