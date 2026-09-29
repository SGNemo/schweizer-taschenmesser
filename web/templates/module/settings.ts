import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

const schema = z.object({
  showDone: z.boolean(),
});

export const settings: ModuleSettings = {
  schema,
  defaults: { showDone: true },
  fields: [{ key: 'showDone', label: 'Erledigte anzeigen', type: 'boolean' }],
};
