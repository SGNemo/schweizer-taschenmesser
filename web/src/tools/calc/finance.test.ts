import { describe, expect, it } from 'vitest';
import { annuityLoan, compoundInterest, discount } from './finance';

describe('discount', () => {
  it('applies a percentage', () => {
    expect(discount(80, 25)).toEqual({ saving: 20, final: 60 });
    expect(discount(19.99, 15)).toEqual({ saving: 3, final: 16.99 });
    expect(discount(100, 0)).toEqual({ saving: 0, final: 100 });
  });
  it('rejects nonsense', () => {
    expect(discount(-1, 10)).toBeUndefined();
    expect(discount(10, 101)).toBeUndefined();
    expect(discount(Number.NaN, 10)).toBeUndefined();
  });
});

describe('compoundInterest', () => {
  it('matches the textbook values', () => {
    expect(compoundInterest(1000, 5, 10, 1)?.final).toBe(1628.89);
    expect(compoundInterest(1000, 0, 10, 1)).toEqual({ final: 1000, deposited: 1000, interest: 0 });
  });
  it('adds monthly deposits', () => {
    const r = compoundInterest(0, 0, 1, 12, 100);
    expect(r).toEqual({ final: 1200, deposited: 1200, interest: 0 });
    const s = compoundInterest(0, 6, 10, 12, 100)!;
    expect(s.deposited).toBe(12000);
    expect(s.final).toBeGreaterThan(12000);
  });
  it('rejects nonsense', () => {
    expect(compoundInterest(1000, -1, 10, 1)).toBeUndefined();
    expect(compoundInterest(1000, 5, 101, 1)).toBeUndefined();
  });
});

describe('annuityLoan', () => {
  it('matches the textbook value', () => {
    // 10 000 at 5 % for 10 years, monthly payments
    const l = annuityLoan(10_000, 5, 10)!;
    expect(l.monthly).toBe(106.07);
    expect(l.months).toBe(120);
    expect(l.total).toBe(12727.86);
    expect(l.interest).toBe(2727.86);
  });
  it('handles 0 % and rejects nonsense', () => {
    expect(annuityLoan(1200, 0, 1)?.monthly).toBe(100);
    expect(annuityLoan(0, 5, 1)).toBeUndefined();
    expect(annuityLoan(1000, 5, 0)).toBeUndefined();
  });
});
