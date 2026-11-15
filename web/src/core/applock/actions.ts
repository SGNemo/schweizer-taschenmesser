/** What the settings section does with the app lock. The PIN is passed through, never kept. */
import { disableBiometric } from './biometric';
import { resetFails } from './fails';
import { checkPin, removePin, setPin, type PinCheck } from './pin';
import { writePrefs } from './prefs';

/** Stores the new PIN's verifier and switches the lock on (the app stays open until it locks). */
export async function turnOnAppLock(pin: string): Promise<void> {
  await setPin(pin);
  resetFails();
  writePrefs({ enabled: true });
}

/** Needs the current PIN; removes the verifier and the biometric seal. */
export async function turnOffAppLock(currentPin: string): Promise<PinCheck> {
  const check = await checkPin(currentPin);
  if (check !== 'ok') return check;
  writePrefs({ enabled: false });
  await disableBiometric();
  await removePin();
  resetFails();
  return 'ok';
}

export async function changeAppLockPin(currentPin: string, nextPin: string): Promise<PinCheck> {
  const check = await checkPin(currentPin);
  if (check !== 'ok') return check;
  await setPin(nextPin);
  return 'ok';
}
