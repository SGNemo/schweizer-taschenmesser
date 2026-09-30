import { describe, expect, it } from 'vitest';
import { digestHex } from './logic';

describe('digestHex', () => {
  it('matches the well-known digests of "abc"', async () => {
    expect(await digestHex('SHA-1', 'abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(await digestHex('SHA-256', 'abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect((await digestHex('SHA-512', 'abc')).startsWith('ddaf35a193617aba')).toBe(true);
  });
  it('hashes the empty string', async () => {
    expect(await digestHex('SHA-256', '')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});
