import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

export const settingsSchema = z.object({
  cancelRemindDaysBefore: z.number().int().min(0).max(60),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { cancelRemindDaysBefore: 3 },
  fields: [
    {
      key: 'cancelRemindDaysBefore',
      label: 'Erinnerung vor Ende der Kündigungsfrist (Tage)',
      type: 'number',
      help: '0 = am letzten Tag der Frist, Uhrzeit 09:00',
    },
  ],
};
