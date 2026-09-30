/**
 * Passphrase → key for the sync vault (protocol 2): Argon2id through the crypto service, the same
 * KDF as the password vault and the encrypted backups. The server stores only the salt, the
 * parameters and an encrypted check value; there is no PBKDF2 fallback.
 */
import { DEFAULT_KDF, deriveKey, newKdfParams, type KdfParams } from '@/core/crypto/kdf';
import type { VaultInfo } from './adapters/selfHosted';

export { DEFAULT_KDF };

/** Fresh parameters and salt for a new vault. */
export function newVaultParams(overrides: { m?: number; t?: number; p?: number } = {}): KdfParams {
  return newKdfParams(overrides);
}

export const toVaultInfo = (params: KdfParams, check: string): VaultInfo => ({
  salt: params.salt,
  check,
  v: 2,
  kdf: { alg: 'argon2id', m: params.m, t: params.t, p: params.p },
});

/** `undefined` for a legacy (PBKDF2) vault: it cannot be joined. */
export function vaultParams(vault: VaultInfo): KdfParams | undefined {
  if (vault.v !== 2 || !vault.kdf) return undefined;
  return { ...vault.kdf, salt: vault.salt };
}

export const deriveVaultKey = (passphrase: string, params: KdfParams): Promise<CryptoKey> =>
  deriveKey(passphrase, params);
