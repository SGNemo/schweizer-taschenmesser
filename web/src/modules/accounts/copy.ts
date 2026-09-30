import { getPlatform } from '@/core/platform';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';

export const CLIPBOARD_CLEAR_MS = 30_000;

/** Copies a secret and clears the clipboard after 30 s (unless the user copied something else). */
export async function copySecret(what: string, value: string): Promise<void> {
  await getPlatform().clipboard.writeSensitive(value, CLIPBOARD_CLEAR_MS);
  useUiStore.getState().toast(t.accounts.copied(what));
}
