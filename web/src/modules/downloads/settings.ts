import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

const schema = z.object({
  limitKb: z.number().min(0),
  folder: z.string(),
});

export type DownloadsPrefs = z.output<typeof schema>;

export const settings: ModuleSettings = {
  schema,
  defaults: { limitKb: 0, folder: '' },
  fields: [
    {
      key: 'limitKb',
      get label() {
        return t.downloads.settings.limitKb;
      },
      type: 'number',
    },
    {
      key: 'folder',
      get label() {
        return t.downloads.settings.folder;
      },
      type: 'text',
    },
  ],
};
