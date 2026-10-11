import { describe, expect, it } from 'vitest';
import { fromBase32, toBase32 } from '../src/base32.ts';

describe('base32', () => {
  it('round-trips every length and accepts only the canonical string', () => {
    for (let n = 0; n <= 8; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 255);
      const text = toBase32(bytes);
      expect(fromBase32(text), text).toEqual(bytes);
      const leftover = ((text.length + 1) * 5) % 8;
      // A surplus zero symbol that only adds padding never decodes: one byte array, one string.
      if (leftover >= 5) expect(fromBase32(`${text}0`), `${text}0`).toBeNull();
      // A trailing non-zero symbol is surplus or a set padding bit unless it completes a byte.
      if (leftover !== 0) expect(fromBase32(`${text}1`), `${text}1`).toBeNull();
    }
  });

  it('rejects non-zero padding bits and foreign characters', () => {
    expect(toBase32(Uint8Array.from([0x61]))).toBe('C4'); // 01100 001|00
    expect(fromBase32('C4')).toEqual(Uint8Array.from([0x61]));
    expect(fromBase32('C5')).toBeNull(); // same byte, padding bit set
    expect(fromBase32('C')).toBeNull(); // 5 leftover bits
    expect(fromBase32('C40')).toBeNull(); // 7 leftover bits: one symbol too many
    expect(fromBase32('cr')).toBeNull();
    expect(fromBase32('C-R')).toBeNull();
    expect(fromBase32('')).toEqual(Uint8Array.from([]));
  });
});
