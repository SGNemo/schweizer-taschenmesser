/**
 * Authenticated encryption with AES-256-GCM (WebCrypto). Every call draws a fresh random 96-bit
 * nonce; the additional authenticated data (AAD) binds a ciphertext to where it belongs, so it cannot
 * be moved to another record.
 *
 * Token format: `v1.<nonce base64>.<ciphertext+tag base64>`.
 */
import { fromBase64, toBase64 } from '@/core/sync/crypto';
import { CryptoError } from './errors';
import { randomBytes } from './random';

const PREFIX = 'v1.';
const NONCE_BYTES = 12;
const enc = new TextEncoder();
const dec = new TextDecoder();

export async function seal(
  key: CryptoKey,
  aad: string,
  plaintext: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const iv = randomBytes(NONCE_BYTES);
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(aad) },
    key,
    plaintext,
  );
  return `${PREFIX}${toBase64(iv)}.${toBase64(new Uint8Array(data))}`;
}

export async function open(
  key: CryptoKey,
  aad: string,
  token: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const parts = token.startsWith(PREFIX) ? token.slice(PREFIX.length).split('.') : [];
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new CryptoError('malformed');
  let iv: Uint8Array<ArrayBuffer>;
  let data: Uint8Array<ArrayBuffer>;
  try {
    iv = fromBase64(parts[0]);
    data = fromBase64(parts[1]);
  } catch {
    throw new CryptoError('malformed');
  }
  if (iv.length !== NONCE_BYTES) throw new CryptoError('malformed');
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData: enc.encode(aad) },
        key,
        data,
      ),
    );
  } catch {
    throw new CryptoError('wrong-key');
  }
}

export const sealJson = (key: CryptoKey, aad: string, value: unknown): Promise<string> =>
  seal(key, aad, enc.encode(JSON.stringify(value)));

export async function openJson(key: CryptoKey, aad: string, token: string): Promise<unknown> {
  const bytes = await open(key, aad, token);
  try {
    return JSON.parse(dec.decode(bytes));
  } catch {
    throw new CryptoError('malformed');
  }
}
