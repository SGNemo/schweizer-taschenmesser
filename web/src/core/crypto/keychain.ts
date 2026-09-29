/**
 * Key hierarchy of a password-protected vault:
 *
 *   master password ──Argon2id(salt)──▶ KEK ──AES-GCM──▶ wrapped DEK   (stored in the header)
 *   DEK (random 256 bit) ─AES-GCM per entry─▶ ciphertext               (stored per record)
 *
 * Changing the master password only re-wraps the DEK; entries are not touched. Neither password nor
 * keys are ever persisted – only the header (salt, KDF parameters, wrapped DEK) is, and it is
 * useless without the password. Keys live as non-extractable `CryptoKey`s; the DEK's raw bytes exist
 * only for the moment they are wrapped/unwrapped and are overwritten right after.
 */
import { z } from 'zod';
import { open, seal } from './aead';
import { CryptoError } from './errors';
import { assertKdfParams, deriveKey, newKdfParams, type KdfParams } from './kdf';
import { randomBytes, wipe } from './random';

const headerSchema = z.object({
  v: z.literal(1),
  vaultId: z.string().min(8),
  kdf: z.object({
    alg: z.literal('argon2id'),
    m: z.number(),
    t: z.number(),
    p: z.number(),
    salt: z.string().min(1),
  }),
  wrappedDek: z.string().min(1),
  /** A known plaintext sealed with the DEK: proves that a key (e.g. one released by a biometric prompt) is *this vault's* key. */
  check: z.string().min(1),
});

export type KeychainHeader = z.output<typeof headerSchema>;

const dekAad = (vaultId: string) => `${vaultId}/dek`;
const checkAad = (vaultId: string) => `${vaultId}/check`;
const CHECK_TEXT = new TextEncoder().encode('taschenmesser-vault-key-check');

export function parseHeader(json: string): KeychainHeader {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new CryptoError('malformed', 'header is not JSON');
  }
  const parsed = headerSchema.safeParse(raw);
  if (!parsed.success) throw new CryptoError('malformed', 'bad header');
  return parsed.data;
}

export const serializeHeader = (header: KeychainHeader): string => JSON.stringify(header);

/** Non-extractable AES-GCM key from raw DEK bytes; the bytes are overwritten afterwards. */
export async function dekFromBytes(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return importDek(raw);
}

async function importDek(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  try {
    return await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  } finally {
    wipe(raw);
  }
}

export interface KdfOverrides {
  m?: number;
  t?: number;
  p?: number;
}

/** Creates a fresh vault: new id, new random DEK, wrapped with a KEK from `password`. */
export async function createKeychain(
  password: string,
  kdf: KdfOverrides = {},
): Promise<{ header: KeychainHeader; dek: CryptoKey }> {
  const params = newKdfParams(kdf);
  const vaultId = crypto.randomUUID();
  const kek = await deriveKey(password, params);
  const raw = randomBytes(32);
  const wrappedDek = await seal(kek, dekAad(vaultId), raw);
  const dek = await importDek(raw);
  const check = await seal(dek, checkAad(vaultId), CHECK_TEXT);
  return { header: { v: 1, vaultId, kdf: params, wrappedDek, check }, dek };
}

/** Wrong password (or tampered header) → `CryptoError('wrong-key')`. */
export async function unlockKeychain(password: string, header: KeychainHeader): Promise<CryptoKey> {
  const kek = await deriveKey(password, header.kdf as KdfParams);
  return importDek(await open(kek, dekAad(header.vaultId), header.wrappedDek));
}

/** Does `dek` belong to this vault? (`false` for any other key, including a stale or foreign one.) */
export async function verifyDek(header: KeychainHeader, dek: CryptoKey): Promise<boolean> {
  try {
    const plain = await open(dek, checkAad(header.vaultId), header.check);
    return plain.length === CHECK_TEXT.length && plain.every((b, i) => b === CHECK_TEXT[i]);
  } catch {
    return false;
  }
}

/**
 * The raw data key, for sealing it in an OS keystore behind a biometric prompt (the only place where
 * it leaves the non-extractable form). The caller must `wipe` it right after use. Wrong password →
 * `CryptoError('wrong-key')`.
 */
export async function unwrapDekBytes(
  password: string,
  header: KeychainHeader,
): Promise<Uint8Array<ArrayBuffer>> {
  const kek = await deriveKey(password, header.kdf as KdfParams);
  return open(kek, dekAad(header.vaultId), header.wrappedDek);
}

/** New master password, same DEK: only the header changes (new salt, new KEK). */
export async function rewrapKeychain(
  oldPassword: string,
  newPassword: string,
  header: KeychainHeader,
  kdf: KdfOverrides = {},
): Promise<KeychainHeader> {
  assertKdfParams(header.kdf as KdfParams);
  const oldKek = await deriveKey(oldPassword, header.kdf as KdfParams);
  const raw = await open(oldKek, dekAad(header.vaultId), header.wrappedDek);
  try {
    const params = newKdfParams({ m: header.kdf.m, t: header.kdf.t, p: header.kdf.p, ...kdf });
    const newKek = await deriveKey(newPassword, params);
    const wrappedDek = await seal(newKek, dekAad(header.vaultId), raw);
    return { ...header, kdf: params, wrappedDek };
  } finally {
    wipe(raw);
  }
}
