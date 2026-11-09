import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

/**
 * 24 h or 12 h follows the format region (Settings → Sprache & Format); seconds are never shown, so neither is a
 * setting here. The one switch: the IANA zone under each place on the page.
 */
const schema = z.object({
  showZone: z.boolean(),
});

export type ClockPrefs = z.output<typeof schema>;

export const settings: ModuleSettings = {
  schema,
  defaults: { showZone: true } satisfies ClockPrefs,
  fields: [
    {
      key: 'showZone',
      get label() {
        return t.clock.meta.showZone;
      },
      get help() {
        return t.clock.meta.showZoneHelp;
      },
      type: 'boolean',
    },
  ],
};
