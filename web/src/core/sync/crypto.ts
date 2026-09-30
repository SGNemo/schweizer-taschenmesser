/**
 * Optional end-to-end encryption of synced field values: PBKDF2-SHA-256 (passphrase → AES-GCM key)
 * and AES-GCM per value. Collection, record id, field name and HLC stay readable for the server
 * (it needs them to apply "greatest HLC wins"); the values do not.
 */
import type { FieldOp } from './types';
import { SyncError } from './types';

export const PBKDF2_ITERATIONS = 600_000;
const PREFIX = 'enc:v1:';
const CHECK_PLAINTEXT = 'taschenmesser-vault-v1';
const CHECK_AAD = 'vault-check';

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** base64url (as used for VAPID keys) → bytes. */
export function fromBase64Url(b64url: string): Uint8Array<ArrayBuffer> {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/');
  return fromBase64(padded + '='.repeat((4 - (padded.length % 4)) % 4));
}

export function newSalt(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(16)));
}

/** Non-extractable AES-GCM key derived from the passphrase. */
export async function deriveKey(
  passphrase: string,
  saltBase64: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(saltBase64), iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export const isEncrypted = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(PREFIX);

/** Binds the ciphertext to its location so values cannot be swapped between fields or records. */
const aadOf = (op: Pick<FieldOp, 'collection' | 'id' | 'field'>): string =>
  `${op.collection}/${op.id}/${op.field}`;

export async function encryptValue(key: CryptoKey, aad: string, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(aad) },
    key,
    enc.encode(JSON.stringify(value ?? null)),
  );
  return `${PREFIX}${toBase64(iv)}:${toBase64(new Uint8Array(data))}`;
}

export async function decryptValue(key: CryptoKey, aad: string, cipher: string): Promise<unknown> {
  const [ivB64, dataB64] = cipher.slice(PREFIX.length).split(':');
  if (!ivB64 || !dataB64) throw new SyncError('decrypt', 'malformed ciphertext');
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(ivB64), additionalData: enc.encode(aad) },
      key,
      fromBase64(dataB64),
    );
    return JSON.parse(dec.decode(plain)) as unknown;
  } catch {
    throw new SyncError('decrypt', 'wrong key or corrupted data');
  }
}

/** Stored on the server so another device can verify the passphrase without any user data. */
export const makeVaultCheck = (key: CryptoKey): Promise<string> =>
  encryptValue(key, CHECK_AAD, CHECK_PLAINTEXT);

export async function verifyVaultCheck(key: CryptoKey, check: string): Promise<boolean> {
  if (!isEncrypted(check)) return false;
  try {
    return (await decryptValue(key, CHECK_AAD, check)) === CHECK_PLAINTEXT;
  } catch {
    return false;
  }
}

export async function encryptOps(key: CryptoKey, ops: FieldOp[]): Promise<FieldOp[]> {
  return Promise.all(
    ops.map(async (op) => ({ ...op, value: await encryptValue(key, aadOf(op), op.value) })),
  );
}

export interface DecryptedOps {
  ops: FieldOp[];
  /** Ops that were not encrypted or failed to decrypt; never applied. */
  rejected: number;
}

/** Decrypts pulled ops. Anything that is not valid ciphertext for its location is dropped. */
export async function decryptOps(key: CryptoKey, ops: FieldOp[]): Promise<DecryptedOps> {
  let rejected = 0;
  const out: FieldOp[] = [];
  for (const op of ops) {
    if (!isEncrypted(op.value)) {
      rejected++;
      continue;
    }
    try {
      out.push({ ...op, value: await decryptValue(key, aadOf(op), op.value) });
    } catch {
      rejected++;
    }
  }
  return { ops: out, rejected };
}
