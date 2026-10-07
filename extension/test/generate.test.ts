/* eslint-disable no-restricted-properties -- this test checks that Math.random is never used */
import { describe, expect, it } from 'vitest';
import { DEFAULT_GEN, generate, levelOf, sanitize } from '../src/lib/generate';

describe('generate', () => {
  it('makes a random password with the default settings', async () => {
    const g = await generate(DEFAULT_GEN);
    expect(g.value).toHaveLength(20);
    expect(g.bits).toBeGreaterThan(100);
    expect(g.level).toBe(4);
  });
  it('makes a passphrase from the word list', async () => {
    const g = await generate({ ...DEFAULT_GEN, mode: 'passphrase' });
    expect(g.value.split('-')).toHaveLength(5);
    expect(g.level).toBeGreaterThanOrEqual(2);
  });
  it('never uses Math.random', async () => {
    const orig = Math.random;
    Math.random = () => {
      throw new Error('Math.random used');
    };
    try {
      await generate(DEFAULT_GEN);
      await generate({ ...DEFAULT_GEN, mode: 'passphrase' });
    } finally {
      Math.random = orig;
    }
  });
  it('clamps settings it does not like instead of throwing', async () => {
    const odd = sanitize({
      mode: 'password',
      password: {
        ...DEFAULT_GEN.password,
        length: 9999,
        lower: false,
        upper: false,
        digits: false,
        symbols: false,
      },
      passphrase: { ...DEFAULT_GEN.passphrase, words: 99, separator: 'abcdef' },
    });
    expect(odd.password.lower).toBe(true); // no class selected → defaults
    expect(odd.passphrase.words).toBe(12);
    expect(odd.passphrase.separator).toHaveLength(3);
    const long = sanitize({ ...DEFAULT_GEN, password: { ...DEFAULT_GEN.password, length: 9999 } });
    expect(long.password.length).toBe(128);
    await expect(
      generate({ ...DEFAULT_GEN, password: { ...DEFAULT_GEN.password, length: 1 } }),
    ).resolves.toBeDefined();
  });
  it('rates by entropy', () => {
    expect([30, 50, 70, 90, 120].map(levelOf)).toEqual([0, 1, 2, 3, 4]);
  });
});
