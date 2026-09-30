import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

const schema = z.object({
  defaultView: z.enum(['month', 'week', 'day']),
});

export const settings: ModuleSettings = {
  schema,
  defaults: { defaultView: 'month' },
  fields: [
    {
      key: 'defaultView',
      label: 'Standardansicht',
      type: 'select',
      options: [
        { value: 'month', label: 'Monat' },
        { value: 'week', label: 'Woche' },
        { value: 'day', label: 'Tag' },
      ],
    },
  ],
};
