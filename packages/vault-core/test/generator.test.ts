import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PASSPHRASE_OPTIONS,
  DEFAULT_PASSWORD_OPTIONS,
  characterPools,
  generatePassphrase,
  generatePassword,
  loadWordlist,
  passphraseEntropyBits,
  passwordEntropyBits,
  type PasswordOptions,
} from '../src/generator';

const opts = (o: Partial<PasswordOptions> = {}): PasswordOptions => ({
  ...DEFAULT_PASSWORD_OPTIONS,
  ...o,
});

describe('password generator', () => {
  it('has the requested length and always contains every selected class', () => {
    for (let i = 0; i < 300; i++) {
      const pw = generatePassword(opts({ length: 8 }));
      expect(pw).toHaveLength(8);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[^a-zA-Z0-9]/);
    }
  });

  it('only uses the selected classes', () => {
    for (let i = 0; i < 100; i++) {
      expect(generatePassword(opts({ upper: false, symbols: false, digits: false }))).toMatch(
        /^[a-z]+$/,
      );
      expect(generatePassword(opts({ lower: false, upper: false, symbols: false }))).toMatch(
        /^[0-9]+$/,
      );
    }
  });

  it('can avoid look-alike characters', () => {
    for (let i = 0; i < 200; i++) {
      expect(generatePassword(opts({ avoidAmbiguous: true, length: 64 }))).not.toMatch(
        /[Il1O0o|`'"]/,
      );
    }
  });

  it('draws uniformly from the pool (each of 10 digits ≈ 10 %)', () => {
    const counts = new Array<number>(10).fill(0);
    for (let i = 0; i < 200; i++) {
      for (const c of generatePassword(
        opts({ lower: false, upper: false, symbols: false, length: 100 }),
      )) {
        counts[Number(c)]!++;
      }
    }
    for (const c of counts) {
      expect(c).toBeGreaterThan(1_700); // 20 000 draws → expected 2 000
      expect(c).toBeLessThan(2_300);
    }
  });

  it('gives different results and validates its input', () => {
    expect(new Set(Array.from({ length: 50 }, () => generatePassword())).size).toBe(50);
    expect(() => generatePassword(opts({ length: 7 }))).toThrow(RangeError);
    expect(() => generatePassword(opts({ length: 129 }))).toThrow(RangeError);
    expect(() =>
      generatePassword(opts({ lower: false, upper: false, digits: false, symbols: false })),
    ).toThrow(RangeError);
  });

  it('estimates the entropy from pool size and length', () => {
    expect(
      passwordEntropyBits(opts({ lower: false, upper: false, symbols: false, length: 10 })),
    ).toBeCloseTo(10 * Math.log2(10));
    expect(characterPools(opts({ avoidAmbiguous: true })).flat()).not.toContain('l');
  });
});

describe('passphrase generator', () => {
  it('draws from the EFF large list (7776 words) and joins them', async () => {
    const words = await loadWordlist();
    expect(words).toHaveLength(7776);
    expect(new Set(words).size).toBe(7776);
    const phrase = generatePassphrase(words, DEFAULT_PASSPHRASE_OPTIONS);
    const parts = phrase.split('-');
    expect(parts).toHaveLength(5);
    for (const p of parts) expect(words).toContain(p);
  });

  it('supports capitalisation, a number and a separator; entropy grows with words', async () => {
    const words = await loadWordlist();
    const phrase = generatePassphrase(words, {
      words: 4,
      separator: ' ',
      capitalize: true,
      includeNumber: true,
    });
    expect(phrase.split(' ')).toHaveLength(4);
    expect(phrase).toMatch(/^([A-Z][a-z-]*\d? ?)+$/);
    expect(phrase.match(/\d/g)).toHaveLength(1);
    const five = passphraseEntropyBits(7776, DEFAULT_PASSPHRASE_OPTIONS);
    expect(five).toBeCloseTo(5 * Math.log2(7776));
    expect(
      passphraseEntropyBits(7776, { ...DEFAULT_PASSPHRASE_OPTIONS, words: 6 }),
    ).toBeGreaterThan(five);
  });

  it('validates the word count', () => {
    expect(() =>
      generatePassphrase(['a', 'b'], { ...DEFAULT_PASSPHRASE_OPTIONS, words: 2 }),
    ).toThrow(RangeError);
    expect(() => generatePassphrase(['a'])).toThrow(RangeError);
  });
});
