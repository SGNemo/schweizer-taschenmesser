/**
 * Encrypted backup file: the plain JSON backup (`backup.ts`) sealed with a passphrase through the
 * existing crypto service (`encryptWithPassword`: Argon2id + AES-256-GCM). The plain format is
 * unchanged, so old backups stay importable.
 *
 * File layout (`format`/`version` identify it, `checksum` = SHA-256 of the ciphertext):
 *   { format, version, createdAt, checksum, blob: { format, v, kdf, data } }
 * The checksum detects a damaged or truncated file *before* a passphrase is needed; the AEAD tag
 * additionally proves that nobody modified the content.
 */
import { z } from 'zod';
import {
  CryptoError,
  decryptWithPassword,
  encryptWithPassword,
  type PasswordBlob,
} from '@/core/crypto';
import { parseBackup, serializeBackup, type Backup, type ParseResult } from './backup';

export const ENCRYPTED_BACKUP_FORMAT = 'taschenmesser-backup-encrypted';
export const ENCRYPTED_BACKUP_VERSION = 1;
/** Names the payload inside the blob (bound as AAD, so a blob of another purpose cannot be opened). */
const PAYLOAD_FORMAT = 'taschenmesser-backup-payload';
export const MIN_BACKUP_PASSPHRASE_LENGTH = 8;

const fileSchema = z.object({
  format: z.literal(ENCRYPTED_BACKUP_FORMAT),
  version: z.number().int().min(1),
  createdAt: z.string(),
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
  blob: z.object({
    format: z.string(),
    v: z.literal(1),
    kdf: z.object({
      alg: z.literal('argon2id'),
      m: z.number(),
      t: z.number(),
      p: z.number(),
      salt: z.string(),
    }),
    data: z.string().min(1),
  }),
});

export interface EncryptedBackupFile {
  format: typeof ENCRYPTED_BACKUP_FORMAT;
  version: number;
  createdAt: string;
  /** Hex SHA-256 of `blob.data`. */
  checksum: string;
  blob: PasswordBlob;
}

export type EncryptedParseResult =
  | { ok: true; file: EncryptedBackupFile }
  | { ok: false; reason: 'not-json' | 'wrong-format' | 'newer-version' | 'invalid' };

export type ReadFailure =
  | Extract<ParseResult, { ok: false }>['reason']
  | 'passphrase-required'
  | 'wrong-passphrase'
  | 'checksum-mismatch';

export type ReadResult =
  { ok: true; backup: Backup; encrypted: boolean } | { ok: false; reason: ReadFailure };

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function encryptBackup(
  backup: Backup,
  passphrase: string,
  kdf: { m?: number; t?: number; p?: number } = {},
  createdAt: Date = new Date(),
): Promise<EncryptedBackupFile> {
  const blob = await encryptWithPassword(PAYLOAD_FORMAT, passphrase, serializeBackup(backup), kdf);
  return {
    format: ENCRYPTED_BACKUP_FORMAT,
    version: ENCRYPTED_BACKUP_VERSION,
    createdAt: createdAt.toISOString(),
    checksum: await sha256Hex(blob.data),
    blob,
  };
}

export const serializeEncryptedBackup = (file: EncryptedBackupFile): string => JSON.stringify(file);

export function encryptedBackupFileName(date: Date = new Date()): string {
  return `taschenmesser-backup-${date.toISOString().slice(0, 10)}.enc.json`;
}

/** Cheap sniffing so the UI knows whether to ask for a passphrase. */
export function isEncryptedBackupText(text: string): boolean {
  try {
    return (JSON.parse(text) as { format?: unknown }).format === ENCRYPTED_BACKUP_FORMAT;
  } catch {
    return false;
  }
}

export function parseEncryptedBackup(text: string): EncryptedParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  if (
    typeof json !== 'object' ||
    json === null ||
    (json as { format?: unknown }).format !== ENCRYPTED_BACKUP_FORMAT
  ) {
    return { ok: false, reason: 'wrong-format' };
  }
  const version = (json as { version?: unknown }).version;
  if (typeof version === 'number' && version > ENCRYPTED_BACKUP_VERSION)
    return { ok: false, reason: 'newer-version' };
  const parsed = fileSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  return { ok: true, file: parsed.data as EncryptedBackupFile };
}

export async function checksumMatches(file: EncryptedBackupFile): Promise<boolean> {
  return (await sha256Hex(file.blob.data)) === file.checksum;
}

/** Checksum, then decryption, then the same validation as a plain backup. */
export async function decryptBackup(
  file: EncryptedBackupFile,
  passphrase: string,
): Promise<ReadResult> {
  if (!(await checksumMatches(file))) return { ok: false, reason: 'checksum-mismatch' };
  let plain: string;
  try {
    plain = await decryptWithPassword(PAYLOAD_FORMAT, passphrase, file.blob);
  } catch (e) {
    // Wrong passphrase and a manipulated file are indistinguishable by design (AEAD).
    if (e instanceof CryptoError && e.code === 'wrong-key')
      return { ok: false, reason: 'wrong-passphrase' };
    return { ok: false, reason: 'invalid' };
  }
  const parsed = parseBackup(plain);
  return parsed.ok ? { ok: true, backup: parsed.backup, encrypted: true } : parsed;
}

/** Reads either kind of backup text. Plain backups need no passphrase. */
export async function readBackupText(text: string, passphrase?: string): Promise<ReadResult> {
  if (!isEncryptedBackupText(text)) {
    const parsed = parseBackup(text);
    return parsed.ok ? { ok: true, backup: parsed.backup, encrypted: false } : parsed;
  }
  const file = parseEncryptedBackup(text);
  if (!file.ok) return file;
  if (!passphrase) {
    return (await checksumMatches(file.file))
      ? { ok: false, reason: 'passphrase-required' }
      : { ok: false, reason: 'checksum-mismatch' };
  }
  return decryptBackup(file.file, passphrase);
}

/** Short fingerprint of a file for display (first 12 hex chars of its SHA-256). */
export async function fingerprint(text: string): Promise<string> {
  return (await sha256Hex(text)).slice(0, 12);
}
