/**
 * Supporter state (synced scope `supporter`, end-to-end encrypted like all settings): the code the
 * user entered plus two cosmetic switches. Tier, name and date are never stored – they are derived
 * from the code on every read, so a synced field can never grant anything by itself.
 */
import { z } from 'zod';
import { useSettings } from '@/core/settings/settings';

export const SUPPORTER_SCOPE = 'supporter';

export const supporterSettingsSchema = z.object({
  /** Canonical code, '' = none. */
  code: z.string().max(600),
  /** Local date the code was entered (`YYYY-MM-DD`), '' = none. */
  addedAt: z.string().max(10),
  /** Show the thank-you badge next to the logo in the sidebar (off by default). */
  showSidebarBadge: z.boolean(),
  /** "Don't show again" for the optional hint at the end of the setup assistant. */
  hideSetupHint: z.boolean(),
});
export type SupporterSettings = z.infer<typeof supporterSettingsSchema>;

export const DEFAULT_SUPPORTER: SupporterSettings = {
  code: '',
  addedAt: '',
  showSidebarBadge: false,
  hideSetupHint: false,
};

export function useSupporterSettings() {
  return useSettings(SUPPORTER_SCOPE, supporterSettingsSchema, DEFAULT_SUPPORTER);
}
