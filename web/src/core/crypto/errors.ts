/**
 * - `wrong-key`: the key/password does not open this ciphertext (or it was tampered with – AES-GCM
 *   cannot tell the two apart, and neither should the UI)
 * - `malformed`: the stored value or header is not in a format we produce
 * - `unsafe-params`: KDF parameters outside the accepted range (weak or absurdly expensive)
 */
export type CryptoErrorCode = 'wrong-key' | 'malformed' | 'unsafe-params';

export class CryptoError extends Error {
  constructor(
    readonly code: CryptoErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'CryptoError';
  }
}
