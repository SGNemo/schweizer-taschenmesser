import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

export const settingsSchema = z.object({
  /** Show the feeds under their group names; off = one alphabetical list. */
  grouped: z.boolean(),
});
export type FeedsSettings = z.output<typeof settingsSchema>;

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { grouped: true } satisfies FeedsSettings,
  fields: [
    {
      key: 'grouped',
      get label() {
        return t.feeds.meta.settings.grouped;
      },
      get help() {
        return t.feeds.meta.settings.groupedHelp;
      },
      type: 'boolean',
    },
  ],
};
