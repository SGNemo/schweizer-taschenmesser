import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

const schema = z.object({
  defaultView: z.enum(['month', 'week', 'day']),
});

export const settings: ModuleSettings = {
  schema,
  defaults: { defaultView: 'month' },
  fields: [
    {
      key: 'defaultView',
      label: t.calendar.meta.settings.defaultView,
      type: 'select',
      options: [
        { value: 'month', label: t.calendar.meta.settings.defaultView_month },
        { value: 'week', label: t.calendar.meta.settings.defaultView_week },
        { value: 'day', label: t.calendar.meta.settings.defaultView_day },
      ],
    },
  ],
};
