import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

export const settingsSchema = z.object({
  remindDaysBefore: z.number().int().min(0).max(30),
  remindTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { remindDaysBefore: 0, remindTime: '09:00' },
  fields: [
    {
      key: 'remindDaysBefore',
      label: 'Erinnerung vor dem Geburtstag (Tage)',
      type: 'number',
      help: '0 = am Geburtstag selbst',
    },
    { key: 'remindTime', label: 'Uhrzeit der Erinnerung', type: 'text', help: 'Format HH:mm' },
  ],
};
