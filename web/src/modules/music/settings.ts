import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { tSpotify } from '@/strings.spotify';

/**
 * The connection and its features belong to Einstellungen → Verbindungen (Spotify); the module's own settings only hold
 * what the page itself does: the keyboard shortcuts (on by default, can be switched off).
 */
export const settingsSchema = z.object({ shortcuts: z.boolean() });
export type MusicPrefs = z.output<typeof settingsSchema>;

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { shortcuts: true } satisfies MusicPrefs,
  fields: [
    {
      key: 'shortcuts',
      get label() {
        return tSpotify.get().shortcutsSetting;
      },
      get help() {
        return tSpotify.get().shortcutsHelp;
      },
      type: 'boolean',
    },
  ],
};
