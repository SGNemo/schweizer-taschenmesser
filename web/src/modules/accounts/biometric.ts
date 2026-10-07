/**
 * Optional "unlock with fingerprint / Windows Hello". The vault's data key (DEK) is sealed by the
 * platform behind a biometric prompt (`PlatformService.biometrics`); the master password itself is
 * never stored. Enabling needs the master password once (to unwrap the DEK). The sealed key is bound
 * to the vault id; if the device's biometrics change, the OS destroys it and the master password is
 * needed again. Without biometrics on the device the whole feature is simply unavailable.
 */
import {
  CryptoError,
  dekFromBytes,
  unwrapDekBytes,
  vaultSealName,
  verifyDek,
  wipe,
} from '@/core/crypto';
import { getPlatform, type BiometricPromptText } from '@/core/platform';
import { t } from '@/strings';
import { readHeader, unlockWithDek, VaultError } from './vault';

/** Shared with the device reset (`core/reset`), which must drop the seal without importing this module. */
export const sealName = vaultSealName;

const prompt = (): BiometricPromptText => ({
  title: t.accounts.biometric.promptTitle,
  subtitle: t.accounts.biometric.promptSubtitle,
  cancel: t.actions.cancel,
});

export interface BiometricStatus {
  available: boolean;
  enrolled: boolean;
}

export async function biometricStatus(): Promise<BiometricStatus> {
  const { biometrics } = getPlatform();
  if (!(await biometrics.available())) return { available: false, enrolled: false };
  const found = await readHeader();
  if (found.state !== 'ready') return { available: true, enrolled: false };
  return { available: true, enrolled: await biometrics.has(sealName(found.header.vaultId)) };
}

/** Verifies the master password, then seals the data key behind the biometric prompt. */
export async function enableBiometricUnlock(
  masterPassword: string,
): Promise<'enabled' | 'cancelled'> {
  const found = await readHeader();
  if (found.state !== 'ready') throw new VaultError('missing');
  const { biometrics } = getPlatform();
  if (!(await biometrics.available())) throw new VaultError('locked');
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = await unwrapDekBytes(masterPassword, found.header);
  } catch (e) {
    if (e instanceof CryptoError && e.code === 'wrong-key') throw new VaultError('wrong-password');
    throw e;
  }
  try {
    const result = await biometrics.seal(sealName(found.header.vaultId), raw, prompt());
    return result === 'sealed' ? 'enabled' : 'cancelled';
  } finally {
    wipe(raw);
  }
}

export async function disableBiometricUnlock(): Promise<void> {
  const found = await readHeader();
  if (found.state === 'ready')
    await getPlatform().biometrics.remove(sealName(found.header.vaultId));
}

export type BiometricUnlockResult = 'ok' | 'cancelled' | 'invalid' | 'unavailable';

/**
 * Asks for the biometric, checks with the header's key check that the released key really is this
 * vault's data key (a stale or foreign key must never look like "unlocked") and starts the session.
 */
export async function unlockWithBiometrics(): Promise<BiometricUnlockResult> {
  const found = await readHeader();
  if (found.state !== 'ready') return 'unavailable';
  const { biometrics } = getPlatform();
  if (!(await biometrics.available())) return 'unavailable';
  const name = sealName(found.header.vaultId);

  const result = await biometrics.unseal(name, prompt());
  if (result.status === 'cancelled') return 'cancelled';
  if (result.status !== 'ok') {
    if (result.status === 'invalidated') await biometrics.remove(name);
    return 'invalid';
  }

  const dek = await dekFromBytes(result.secret);
  if (!(await verifyDek(found.header, dek))) {
    await biometrics.remove(name); // stale or foreign key: it must never look like "unlocked"
    return 'invalid';
  }
  unlockWithDek(found.header, dek);
  return 'ok';
}
