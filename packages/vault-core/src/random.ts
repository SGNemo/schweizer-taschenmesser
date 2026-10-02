/** Randomness from the platform CSPRNG only (`crypto.getRandomValues`), injectable for tests. */

export interface Rng {
  /** Uniform integer in [0, max). */
  int(max: number): number;
}

/**
 * Uniform integer in [0, max) by rejection sampling – no modulo bias, so every character or word
 * of a generated password is equally likely.
 */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max < 1 || max > 0x1_0000_0000) {
    throw new RangeError(`randomInt: max must be an integer in 1..2^32 (got ${max})`);
  }
  if (max === 1) return 0;
  const range = 0x1_0000_0000;
  const limit = range - (range % max); // largest multiple of max that fits
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0]! < limit) return buf[0]! % max;
  }
}

export const csprng: Rng = { int: randomInt };

/** Fisher–Yates with the given RNG. Returns a new array. */
export function shuffled<T>(items: readonly T[], rng: Rng = csprng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
