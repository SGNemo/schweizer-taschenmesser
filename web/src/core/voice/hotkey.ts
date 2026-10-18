import { getPlatform, type HotkeyError } from '@/core/platform';

/** Registers (or, for an empty string, removes) the system-wide voice key in the desktop shell. */
export const applyVoiceHotkey = (accelerator: string): Promise<HotkeyError | null> =>
  getPlatform().desktop.setVoiceHotkey(accelerator || null);
