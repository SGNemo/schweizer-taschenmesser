/**
 * Encrypted vault backup: a JSON file protected by its own password (Argon2id + AES-256-GCM via
 * `core/crypto/passwordBlob`). Independent of sync and of the master password, so it also works to
 * move the vault to a fresh install.
 */
import { z } from 'zod';
import { decryptWithPassword, encryptWithPassword, CryptoError } from '@/core/crypto';
import { now } from '@/core/time/now';
import { entryDataSchema, type EntryData } from './schema';

export const BACKUP_FORMAT = 'taschenmesser-vault-backup';

const payloadSchema = z.object({
  version: z.literal(1),
  exportedAt: z.number(),
  entries: z.array(entryDataSchema),
});

export async function exportEncryptedBackup(
  entries: readonly EntryData[],
  password: string,
  kdf?: { m?: number; t?: number; p?: number },
): Promise<string> {
  const payload = { version: 1, exportedAt: now(), entries };
  return JSON.stringify(
    await encryptWithPassword(BACKUP_FORMAT, password, JSON.stringify(payload), kdf),
    null,
    2,
  );
}

/** Wrong password or damaged file → `CryptoError` (`wrong-key` / `malformed`). */
export async function importEncryptedBackup(text: string, password: string): Promise<EntryData[]> {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    throw new CryptoError('malformed');
  }
  const plain = await decryptWithPassword(BACKUP_FORMAT, password, file);
  try {
    return payloadSchema.parse(JSON.parse(plain)).entries;
  } catch {
    throw new CryptoError('malformed');
  }
}

const signature = (e: EntryData) =>
  JSON.stringify([e.title, e.username, e.url, e.password, e.notes]);

/** Entries of `incoming` that are not already present (same title, user, URL, password, notes). */
export function withoutDuplicates(existing: readonly EntryData[], incoming: readonly EntryData[]) {
  const seen = new Set(existing.map(signature));
  const fresh: EntryData[] = [];
  for (const e of incoming) {
    const s = signature(e);
    if (!seen.has(s)) {
      seen.add(s);
      fresh.push(e);
    }
  }
  return { fresh, duplicates: incoming.length - fresh.length };
}
