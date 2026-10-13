import { t } from '@/strings';
import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

const schema = z.object({
  showDone: z.boolean(),
});

export const settings: ModuleSettings = {
  schema,
  defaults: { showDone: true },
  fields: [
    {
      key: 'showDone',
      get label() {
        return t.__ID__.meta.showDone;
      },
      type: 'boolean',
    },
  ],
};
