import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { tWeatherPage } from '@/strings.weatherPage';

/**
 * The place and the switch belong to the shared `weather` scope (Einstellungen → Verbindungen), which also feeds the
 * overview widget. The module's own settings hold what only the page and the notifications use.
 */
export const settingsSchema = z.object({
  /** One notification for severe weather at the main place (storm, heavy rain, heat, frost). Off until chosen. */
  warnNotify: z.boolean(),
});
export type WeatherPrefs = z.output<typeof settingsSchema>;

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { warnNotify: false } satisfies WeatherPrefs,
  fields: [
    {
      key: 'warnNotify',
      get label() {
        return tWeatherPage.get().warnNotify;
      },
      get help() {
        return tWeatherPage.get().warnNotifyHelp;
      },
      type: 'boolean',
    },
  ],
};
