import { z } from 'zod';
import { useSettings } from '@/core/settings/settings';
import type { CaptureType } from './parser';

/** Types the user can pick as the target for text without any signal. */
export const DEFAULT_TYPES = [
  'todo',
  'event',
  'reminder',
  'bookmark',
  'note',
] as const satisfies readonly CaptureType[];

/** Synced with the other settings; per-device switches (hotkey, tray, autostart) live in `device.ts`. */
export const captureSettingsSchema = z.object({
  defaultType: z.enum(DEFAULT_TYPES).default('todo'),
});

export const CAPTURE_DEFAULTS = { defaultType: 'todo' as const };

export function useCaptureSettings() {
  return useSettings('quickCapture', captureSettingsSchema, CAPTURE_DEFAULTS);
}
