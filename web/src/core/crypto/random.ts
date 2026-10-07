/** Randomness from the platform CSPRNG only (`crypto.getRandomValues`). */

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(length)));
}

// `randomInt` / `shuffled` live in the shared package so the browser extension uses the same code.
export { randomInt, shuffled } from '@nemo/vault-core';

/** Best-effort overwrite of secret bytes (JS cannot guarantee that no other copy exists). */
export function wipe(bytes: Uint8Array): void {
  bytes.fill(0);
}
