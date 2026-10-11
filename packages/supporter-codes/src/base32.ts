/** Crockford Base32 plus a two-symbol checksum, so typos are told apart from foreign codes. */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CHECK_MODULUS = 1021; // prime < 1024 → fits exactly two base32 symbols

export function toBase32(bytes: Uint8Array): string {
  let out = '';
  let acc = 0;
  let bits = 0;
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
    acc &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(acc << (5 - bits)) & 31];
  return out;
}

/** Returns null on any character outside the alphabet, on non-zero padding bits or on a surplus symbol. */
export function fromBase32(text: string): Uint8Array | null {
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const ch of text) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((acc >>> (bits - 8)) & 255);
      bits -= 8;
    }
    acc &= (1 << bits) - 1;
  }
  // Canonical form only: at most 4 leftover bits and all of them zero (one string per byte array).
  if (bits >= 5 || acc !== 0) return null;
  return Uint8Array.from(out);
}

/** Two base32 symbols derived from the bytes (big-number mod a prime). */
export function checksum(bytes: Uint8Array): string {
  let r = 0;
  for (const b of bytes) r = (r * 256 + b) % CHECK_MODULUS;
  return ALPHABET[r >> 5]! + ALPHABET[r & 31]!;
}

/** Crockford forgiveness: case-insensitive, O→0, I/L→1, everything non-alphanumeric ignored. */
export function normaliseSymbols(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}
