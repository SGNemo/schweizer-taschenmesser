/**
 * Vault operations: create, unlock, lock, change the master password, and encrypted entry CRUD.
 * Crypto primitives come from `core/crypto` (Argon2id, AES-256-GCM); this file only decides what is
 * encrypted with what and where the ciphertext lives.
 *
 * Entry ciphertext is bound to `vaultId/entryId/1` (AAD): it cannot be moved to another record or
 * another vault. A record that does not decrypt (other vault after a concurrent setup on two
 * devices, corruption) is reported as `undecryptable`, never thrown at the list.
 */
import {
  CryptoError,
  createKeychain,
  openJson,
  parseHeader,
  rewrapKeychain,
  sealJson,
  serializeHeader,
  unlockKeychain,
  type KeychainHeader,
} from '@/core/crypto';
import type { Stored } from '@/core/db/types';
import { now } from '@/core/time/now';
import { entryRepo, vaultRepo } from './repo';
import { entryDataSchema, VAULT_RECORD_ID, type EntryData, type EntryDraft } from './schema';
import { getSession, setSession, type UnlockedSession } from './session';

export const MIN_MASTER_LENGTH = 10;
const ENTRY_VERSION = 1;

export type VaultErrorCode =
  'exists' | 'missing' | 'corrupt' | 'weak-password' | 'wrong-password' | 'throttled' | 'locked';

export class VaultError extends Error {
  constructor(
    readonly code: VaultErrorCode,
    /** Milliseconds until the next attempt for `throttled`. */
    readonly retryInMs?: number,
  ) {
    super(code);
    this.name = 'VaultError';
  }
}

/** Wrong-password delay: free attempts first, then 1 s, 2 s, 4 s … capped at 30 s. Convenience only – an
 *  attacker with a copy of the data is limited by Argon2id, not by this. */
export function lockoutMs(failures: number): number {
  return failures < 3 ? 0 : Math.min(30_000, 1000 * 2 ** (failures - 3));
}

const attempts = { failures: 0, blockedUntil: 0 };
export const resetAttempts = (): void => {
  attempts.failures = 0;
  attempts.blockedUntil = 0;
};

export type HeaderState =
  { state: 'none' } | { state: 'ready'; header: KeychainHeader } | { state: 'corrupt' };

export async function readHeader(): Promise<HeaderState> {
  const row = await vaultRepo.get(VAULT_RECORD_ID);
  if (!row) return { state: 'none' };
  try {
    return { state: 'ready', header: parseHeader(row.header) };
  } catch {
    return { state: 'corrupt' };
  }
}

function assertStrongEnough(password: string): void {
  if ([...password].length < MIN_MASTER_LENGTH) throw new VaultError('weak-password');
}

function start(header: KeychainHeader, dek: CryptoKey): void {
  resetAttempts();
  setSession({ status: 'unlocked', vaultId: header.vaultId, header, dek });
}

/** First-time setup. Refuses when a vault already exists (e.g. it arrived through sync). */
export async function createVault(
  password: string,
  kdf?: { m?: number; t?: number; p?: number },
): Promise<void> {
  assertStrongEnough(password);
  if ((await readHeader()).state !== 'none') throw new VaultError('exists');
  const { header, dek } = await createKeychain(password, kdf);
  await vaultRepo.upsert(VAULT_RECORD_ID, { header: serializeHeader(header) });
  start(header, dek);
}

export async function unlockVault(password: string): Promise<void> {
  const wait = attempts.blockedUntil - now();
  if (wait > 0) throw new VaultError('throttled', wait);
  const found = await readHeader();
  if (found.state === 'none') throw new VaultError('missing');
  if (found.state === 'corrupt') throw new VaultError('corrupt');
  try {
    start(found.header, await unlockKeychain(password, found.header));
  } catch (e) {
    if (e instanceof CryptoError && e.code === 'wrong-key') {
      attempts.failures += 1;
      attempts.blockedUntil = now() + lockoutMs(attempts.failures);
      throw new VaultError('wrong-password');
    }
    throw new VaultError('corrupt');
  }
}

/** Opens the vault with an already known data key (biometric unlock); the caller has verified it. */
export function unlockWithDek(header: KeychainHeader, dek: CryptoKey): void {
  start(header, dek);
}

/** Drops the key and every reference to decrypted data. */
export function lockVault(): void {
  setSession({ status: 'locked' });
}

function requireSession(): UnlockedSession {
  const s = getSession();
  if (s.status !== 'unlocked') throw new VaultError('locked');
  return s;
}

/** Re-wraps the same data key with a key from the new password; entries are not touched. */
export async function changeMasterPassword(
  oldPassword: string,
  newPassword: string,
  kdf?: { m?: number; t?: number; p?: number },
): Promise<void> {
  const session = requireSession();
  assertStrongEnough(newPassword);
  let header: KeychainHeader;
  try {
    header = await rewrapKeychain(oldPassword, newPassword, session.header, kdf);
  } catch (e) {
    if (e instanceof CryptoError && e.code === 'wrong-key') throw new VaultError('wrong-password');
    throw e;
  }
  await vaultRepo.upsert(VAULT_RECORD_ID, { header: serializeHeader(header) });
  setSession({ ...session, header });
}

const aad = (vaultId: string, entryId: string) => `${vaultId}/${entryId}/${ENTRY_VERSION}`;

export interface DecryptedEntry {
  id: string;
  createdAt: number;
  updatedAt: number;
  data: EntryData;
}
export interface UndecryptableEntry {
  id: string;
  updatedAt: number;
  undecryptable: true;
}

export const isReadable = (e: DecryptedEntry | UndecryptableEntry): e is DecryptedEntry =>
  !('undecryptable' in e);

export async function encryptEntry(entryId: string, draft: EntryDraft): Promise<string> {
  const { vaultId, dek } = requireSession();
  return sealJson(dek, aad(vaultId, entryId), entryDataSchema.parse(draft));
}

export async function decryptRow(
  row: Pick<Stored<{ data: string }>, 'id' | 'data' | 'createdAt' | 'updatedAt'>,
  session: UnlockedSession = requireSession(),
): Promise<DecryptedEntry | UndecryptableEntry> {
  try {
    const value = await openJson(session.dek, aad(session.vaultId, row.id), row.data);
    return {
      id: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      data: entryDataSchema.parse(value),
    };
  } catch {
    return { id: row.id, updatedAt: row.updatedAt, undecryptable: true };
  }
}

export async function saveEntry(draft: EntryDraft, id?: string): Promise<string> {
  requireSession();
  if (id) {
    await entryRepo.update(id, { data: await encryptEntry(id, draft) });
    return id;
  }
  const newId = crypto.randomUUID();
  await entryRepo.create({ data: await encryptEntry(newId, draft) }, { id: newId });
  return newId;
}

export async function deleteEntry(id: string): Promise<void> {
  await entryRepo.remove(id);
}

export async function decryptAll(): Promise<(DecryptedEntry | UndecryptableEntry)[]> {
  const session = requireSession();
  const rows = await entryRepo.active().toArray();
  return Promise.all(rows.map((r) => decryptRow(r, session)));
}
