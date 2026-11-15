/**
 * PIN verifier of the app lock: a fixed marker encrypted with the PIN (Argon2id + AES-GCM through
 * `core/crypto`), kept in the device's secret store. The PIN itself is never stored, logged or kept
 * in a store: callers pass it straight through and drop it.
 */
import { CryptoError, decryptWithPassword, encryptWithPassword } from '@/core/crypto';
import { getPlatform } from '@/core/platform';
import { recordFail, resetFails, waitRemaining } from './fails';
import { PIN_SECRET } from './names';
const FORMAT = 'nemo-app-lock';
const MARKER = 'nemo-app-lock/v1';

export const isValidPin = (pin: string): boolean => /^\d{4,12}$/.test(pin);

/** KDF overrides: tests only (production builds refuse anything below the floor). */
type Kdf = { m?: number; t?: number; p?: number };

export async function setPin(pin: string, kdf: Kdf = {}): Promise<void> {
  if (!isValidPin(pin)) throw new Error('invalid pin format');
  const blob = await encryptWithPassword(FORMAT, pin, MARKER, kdf);
  await getPlatform().secrets.set(PIN_SECRET, JSON.stringify(blob));
}

export const hasPin = (): Promise<boolean> => getPlatform().secrets.has(PIN_SECRET);

export async function removePin(): Promise<void> {
  await getPlatform().secrets.delete(PIN_SECRET);
}

export type PinCheck = 'ok' | 'wrong' | 'wait';

/** Checks the PIN; wrong tries count towards the wait, a correct one resets it. */
export async function checkPin(pin: string): Promise<PinCheck> {
  if (waitRemaining() > 0) return 'wait';
  const stored = await getPlatform().secrets.get(PIN_SECRET);
  let ok = false;
  if (stored && isValidPin(pin)) {
    try {
      ok = (await decryptWithPassword(FORMAT, pin, JSON.parse(stored))) === MARKER;
    } catch (e) {
      if (!(e instanceof CryptoError) && !(e instanceof SyntaxError)) throw e;
    }
  }
  if (ok) {
    resetFails();
    return 'ok';
  }
  recordFail();
  return waitRemaining() > 0 ? 'wait' : 'wrong';
}
