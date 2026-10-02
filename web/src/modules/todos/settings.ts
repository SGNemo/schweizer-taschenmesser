import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

const schema = z.object({
  showDone: z.boolean(),
});

export const settings: ModuleSettings = {
  schema,
  defaults: { showDone: true },
  fields: [{ key: 'showDone', label: t.todos.meta.settings.showDone, type: 'boolean' }],
};
