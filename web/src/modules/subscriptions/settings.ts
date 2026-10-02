import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

export const settingsSchema = z.object({
  cancelRemindDaysBefore: z.number().int().min(0).max(60),
  remindTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { cancelRemindDaysBefore: 3, remindTime: '09:00' },
  fields: [
    {
      key: 'cancelRemindDaysBefore',
      label: 'Erinnerung vor Ende der Kündigungsfrist (Tage)',
      type: 'number',
      help: '0 = am letzten Tag der Frist',
    },
    { key: 'remindTime', label: 'Uhrzeit der Erinnerung', type: 'text', help: 'Format HH:mm' },
  ],
};
