import { describe, expect, it } from 'vitest';
import { parseAddress } from './address';

// Q1 (launch review 2026-11): a raw `From` header with many leading tabs made the old pattern
// backtrack cubically (seconds of main thread). Parsing is linear now, with the same results.
describe('parseAddress on hostile input', () => {
  it('stays fast on thousands of leading whitespace characters', () => {
    for (const raw of [
      '\t'.repeat(2000) + 'x',
      '\t'.repeat(2000) + '"a<',
      ' '.repeat(5000) + '<<<<',
    ]) {
      const began = performance.now();
      parseAddress(raw);
      expect(performance.now() - began).toBeLessThan(50);
    }
  });

  it('keeps the known shapes', () => {
    expect(parseAddress('"Anna Muster" <anna@example.org>')).toEqual({
      name: 'Anna Muster',
      email: 'anna@example.org',
    });
    expect(parseAddress('Anna <anna@example.org>')).toEqual({
      name: 'Anna',
      email: 'anna@example.org',
    });
    expect(parseAddress('<anna@example.org>')).toEqual({
      name: undefined,
      email: 'anna@example.org',
    });
    expect(parseAddress('  anna@example.org ')).toEqual({ email: 'anna@example.org' });
    expect(parseAddress('"" <a@b.c>')).toEqual({ name: undefined, email: 'a@b.c' });
  });
});
