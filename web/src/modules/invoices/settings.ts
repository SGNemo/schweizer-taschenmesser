import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

export const settingsSchema = z.object({
  remindDaysBefore: z.number().int().min(0).max(60),
  remindTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { remindDaysBefore: 2, remindTime: '09:00' },
  fields: [
    {
      key: 'remindDaysBefore',
      label: 'Erinnerung vor Fälligkeit (Tage)',
      type: 'number',
      help: '0 = am Fälligkeitstag',
    },
    { key: 'remindTime', label: 'Uhrzeit der Erinnerung', type: 'text', help: 'Format HH:mm' },
  ],
};
