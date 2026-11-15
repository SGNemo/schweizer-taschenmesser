import { getPlatform } from '@/core/platform';
import { getSettings } from '@/core/settings/settings';
import { useUiStore } from '@/stores/ui';
import { tSecurity } from '@/strings.security';
import { defaultSettings, settingsSchema } from './settings';

/** The default; the user picks 10 s to 2 min in Einstellungen → Sicherheit. */
export const CLIPBOARD_CLEAR_MS = 30_000;

/**
 * The set time, read when the vault page opens (`primeClipboardTime`). Copying must not wait for a
 * database read first: the browser only allows the write while the click is fresh.
 */
let clearMs = CLIPBOARD_CLEAR_MS;

/** Reads the setting `clipboardSeconds`; call when the vault page opens. */
export async function primeClipboardTime(): Promise<number> {
  const { clipboardSeconds } = await getSettings(
    'module.accounts',
    settingsSchema,
    defaultSettings,
  );
  clearMs = Number(clipboardSeconds) * 1000;
  return clearMs;
}

/** Copies a secret and clears the clipboard after the set time (unless the user copied something else). */
export async function copySecret(what: string, value: string): Promise<void> {
  const ms = clearMs;
  await getPlatform().clipboard.writeSensitive(value, ms);
  useUiStore.getState().toast(tSecurity.get().clipboard.copied(what, ms / 1000));
}
