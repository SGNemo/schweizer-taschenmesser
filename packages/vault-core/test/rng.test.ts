import { describe, expect, it } from 'vitest';
import { generatePassphrase, generatePassword, DEFAULT_PASSWORD_OPTIONS } from '../src/generator';
import { randomInt, shuffled, type Rng } from '../src/random';

/** Deterministic RNG: always the lowest value, so output is predictable. */
const zero: Rng = { int: () => 0 };
const counter = (): Rng => {
  let n = 0;
  return { int: (max) => n++ % max };
};

describe('injected RNG', () => {
  it('makes the generator deterministic', () => {
    const a = generatePassword(DEFAULT_PASSWORD_OPTIONS, counter());
    const b = generatePassword(DEFAULT_PASSWORD_OPTIONS, counter());
    expect(a).toBe(b);
    expect(a).toHaveLength(20);
  });
  it('builds passphrases from the given words', () => {
    expect(
      generatePassphrase(
        ['alpha', 'beta'],
        { words: 3, separator: '.', capitalize: true, includeNumber: true },
        zero,
      ),
    ).toBe('Alpha0.Alpha.Alpha');
  });
  it('shuffles with the given RNG without mutating the input', () => {
    const input = [1, 2, 3, 4];
    expect(shuffled(input, zero)).toEqual([2, 3, 4, 1]);
    expect(input).toEqual([1, 2, 3, 4]);
  });
});

describe('randomInt', () => {
  it('stays in range and rejects bad bounds', () => {
    for (let i = 0; i < 200; i++) expect(randomInt(7)).toBeLessThan(7);
    expect(randomInt(1)).toBe(0);
    expect(() => randomInt(0)).toThrow(RangeError);
    expect(() => randomInt(1.5)).toThrow(RangeError);
  });
  it('never calls Math.random', () => {
    const orig = Math.random;
    Math.random = () => {
      throw new Error('Math.random used');
    };
    try {
      generatePassword();
      randomInt(1000);
    } finally {
      Math.random = orig;
    }
  });
});
