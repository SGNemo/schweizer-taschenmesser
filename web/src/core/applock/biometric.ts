/**
 * Optional "unlock with fingerprint or face" for the app lock. 32 random bytes are sealed by the
 * platform behind the biometric prompt (name `app-lock`); only their SHA-256 is kept in the secret
 * store. Unlock = unseal + compare. When the device's biometrics change, the OS destroys the seal:
 * the switch turns off and the PIN is needed (it always works).
 */
import { randomBytes, wipe } from '@/core/crypto';
import { getPlatform, type BiometricPromptText } from '@/core/platform';
import { t } from '@/strings';
import { tAppLock } from '@/strings.applock';
import { checkPin, type PinCheck } from './pin';
import { resetFails } from './fails';
import { BIO_SEAL, BIO_SECRET } from './names';
import { readPrefs, writePrefs } from './prefs';

const prompt = (): BiometricPromptText => ({
  title: tAppLock.get().promptTitle,
  subtitle: tAppLock.get().promptSubtitle,
  cancel: t.actions.cancel,
});

async function hashHex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const biometricAvailable = (): Promise<boolean> =>
  getPlatform()
    .biometrics.available()
    .catch(() => false);

export type EnableResult = 'enabled' | 'cancelled' | 'unavailable' | Exclude<PinCheck, 'ok'>;

/** Needs the current PIN; then the device asks for the fingerprint or face once. */
export async function enableBiometric(currentPin: string): Promise<EnableResult> {
  const check = await checkPin(currentPin);
  if (check !== 'ok') return check;
  const { biometrics, secrets } = getPlatform();
  if (!(await biometricAvailable())) return 'unavailable';
  const raw = randomBytes(32);
  try {
    const hash = await hashHex(raw);
    const result = await biometrics.seal(BIO_SEAL, raw, prompt());
    if (result !== 'sealed') return 'cancelled';
    await secrets.set(BIO_SECRET, hash);
    writePrefs({ biometric: true });
    return 'enabled';
  } finally {
    wipe(raw);
  }
}

export async function disableBiometric(): Promise<void> {
  const { biometrics, secrets } = getPlatform();
  writePrefs({ biometric: false });
  await biometrics.remove(BIO_SEAL).catch(() => undefined);
  await secrets.delete(BIO_SECRET).catch(() => undefined);
}

export type BioUnlock = 'ok' | 'cancelled' | 'invalid' | 'unavailable';

export async function unlockWithBiometric(): Promise<BioUnlock> {
  if (!readPrefs().biometric) return 'unavailable';
  if (!(await biometricAvailable())) return 'unavailable';
  const { biometrics, secrets } = getPlatform();
  const result = await biometrics.unseal(BIO_SEAL, prompt());
  if (result.status === 'cancelled') return 'cancelled';
  if (result.status !== 'ok') {
    // `invalidated` (biometrics changed) or `missing`: the seal is gone, the PIN is the way in.
    await disableBiometric();
    return 'invalid';
  }
  try {
    const expected = await secrets.get(BIO_SECRET);
    if (!expected || (await hashHex(result.secret)) !== expected) {
      await disableBiometric(); // a stale or foreign seal must never look like "unlocked"
      return 'invalid';
    }
  } finally {
    wipe(result.secret);
  }
  resetFails();
  return 'ok';
}
