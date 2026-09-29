import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

const schema = z.object({
  defaultTime: z.string(),
});

export const settings: ModuleSettings = {
  schema,
  defaults: { defaultTime: '09:00' },
  fields: [
    {
      key: 'defaultTime',
      label: 'Standard-Uhrzeit für neue Erinnerungen',
      type: 'text',
      help: 'Format HH:mm, z. B. 09:00',
    },
  ],
};
